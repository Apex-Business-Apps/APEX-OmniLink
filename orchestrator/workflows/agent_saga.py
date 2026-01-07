"""
Agent Workflow with Event Sourcing and Saga Pattern.

This module implements the core orchestration logic using Temporal.io workflows.

Key Concepts:

1. **Event Sourcing**: Workflow state is reconstructed by replaying AgentEvent sequence
   - Ensures deterministic replay (critical for Temporal)
   - Complete audit trail
   - Time-travel debugging

2. **Saga Pattern**: Compensation-based distributed transactions
   - Each successful step registers a compensation activity
   - On failure, compensations execute in LIFO order (rollback)
   - Example: BookFlight → compensation: CancelFlight

3. **Continue-As-New**: Workflow history truncation to prevent runaway memory
   - Temporal workflows have event history limits (~50K events)
   - Continue-as-new creates a new workflow instance with checkpoint state
   - Think of it like log compaction or Git history squashing

4. **Determinism**: Workflows MUST be deterministic for replay
   - No direct LLM calls (non-deterministic) - use Activities instead
   - No random numbers, system time, or network calls
   - All I/O via Activities

5. **DAG Execution**: True parallel execution for independent steps
   - Topological sort identifies execution order
   - Independent steps (no dependencies) execute in parallel via asyncio.gather
   - Steps with depends_on wait for their dependencies

Architecture:
    User Goal → Guardian Check → Semantic Cache Lookup →
    → [Cache Hit: Inject Params] OR [Cache Miss: LLM Plan Generation] →
    → Execute Steps (DAG) with Saga Compensation →
    → [Success: Store Result] OR [Failure: Rollback Saga]
"""

import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Optional

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ActivityError, ApplicationError

# Import our models and activities
with workflow.unsafe.imports_passed_through():
    from models.events import (
        AgentEvent,
        GoalReceived,
        PlanGenerated,
        ToolCallRequested,
        ToolResultReceived,
        WorkflowCompleted,
        WorkflowFailed,
    )
    from orchestrator.models.man_mode import ActionIntent, ManDecision, ManDecisionPayload
    from activities.man_mode import backlog_check, create_man_task, resolve_man_task, risk_triage


# ============================================================================
# SAGA CONTEXT (Compensation Pattern)
# ============================================================================


@dataclass
class CompensationStep:
    """
    A compensation step to execute on rollback.

    Stored in LIFO order (stack) - last successful step compensates first.
    """

    activity_name: str
    input: dict[str, Any]
    step_id: str


@dataclass
class SagaContext:
    """
    Saga context manager for compensation-based distributed transactions.

    Usage in workflow:
        saga = SagaContext(workflow_instance=self)

        # Execute step with compensation
        result = await saga.execute_with_compensation(
            activity="book_flight",
            input={"destination": "Paris"},
            compensation_activity="cancel_flight",
            compensation_input={"booking_id": "{booking_id}"}
        )

        # On failure, saga automatically rolls back all successful steps
        if error:
            await saga.rollback()

    Why Saga Pattern:
    - No distributed transactions (2PC) → eventual consistency
    - Each service maintains local ACID, global consistency via compensations
    - Better resilience (no coordinator bottleneck)
    - Works across heterogeneous systems (SQL + NoSQL + APIs)

    Compensation Guarantees:
    - At-least-once execution (compensations may retry on failure)
    - Idempotent compensations (e.g., CancelBooking checks if exists first)
    - Best-effort rollback (log failures but don't block)
    """

    workflow_instance: Any  # Reference to workflow (for activity execution)
    compensation_stack: list[CompensationStep] = field(default_factory=list)
    rollback_executed: bool = False

    async def execute_with_compensation(
        self,
        activity_name: str,
        activity_input: dict[str, Any],
        compensation_activity: Optional[str] = None,
        compensation_input: Optional[dict[str, Any]] = None,
        step_id: str = "",
    ) -> dict[str, Any]:
        """
        Execute activity and register compensation on success.

        Args:
            activity_name: Activity to execute
            activity_input: Activity input params
            compensation_activity: Compensation activity name (if any)
            compensation_input: Compensation input (can use {result.field} placeholders)
            step_id: Step ID for tracking

        Returns:
            Activity result

        Raises:
            ActivityError: If activity fails after retries
        """
        # Execute main activity
        result = await self.workflow_instance._execute_activity(
            activity_name, activity_input, step_id
        )

        # Register compensation (only on success)
        if compensation_activity:
            # Inject result values into compensation input
            comp_input = compensation_input or {}
            injected_input = self._inject_result_values(comp_input, result)

            compensation = CompensationStep(
                activity_name=compensation_activity,
                input=injected_input,
                step_id=step_id,
            )
            self.compensation_stack.append(compensation)

            stack_size = len(self.compensation_stack)
            workflow.logger.info(
                f"✓ Registered compensation: {compensation_activity} " f"(stack size={stack_size})"
        )

        return result

    # ============================================================================
    # MAN MODE HELPER METHODS
    # ============================================================================

    def _get_tenant_id(self) -> str:
        """
        Extract tenant ID from workflow context.

        In production, this would extract from authentication context or workflow metadata.
        For now, use a default or extract from user_id.
        """
        # TODO: Extract from JWT or workflow search attributes
        return "default_tenant"  # Placeholder

    def _get_workflow_key(self) -> Optional[str]:
        """
        Get workflow-specific key for policy overrides.

        Returns workflow identifier for per-workflow policy configuration.
        """
        return self.plan_id or None

    def _extract_step_flags(self, step: dict[str, Any]) -> dict[str, Any]:
        """
        Extract MAN Mode flags from step metadata.

        Args:
            step: Step definition from plan

        Returns:
            Dict of flags for ActionIntent
        """
        flags = {}

        # Check tool name for known risky tools
        tool_name = step.get("tool", "")
        if tool_name in {"send_email", "call_webhook", "create_record", "delete_record"}:
            flags["irreversible"] = True

        # Check for sensitive data patterns in parameters
        params = step.get("input", {})
        param_keys = str(params.keys()).lower()
        if any(sensitive in param_keys for sensitive in ["password", "secret", "token", "key"]):
            flags["contains_sensitive_data"] = True

        # Check for rights-affecting operations
        if tool_name in {"update_user", "delete_user", "change_permissions"}:
            flags["affects_rights"] = True

        return flags

    async def _wait_for_man_decision(self, task_id: str, step_id: str) -> None:
        """
        Wait for a MAN decision to be submitted.

        Uses workflow.wait_condition to pause execution until decision is received.

        Args:
            task_id: MAN task identifier
            step_id: Step identifier

        Raises:
            ApplicationError: If decision is DENY or CANCEL_WORKFLOW
        """
        workflow.logger.info(f"⏳ Waiting for MAN decision on step {step_id} (task: {task_id})")

        # Wait for decision to be submitted via update
        await workflow.wait_condition(lambda: task_id in self.pending_man_decisions)

        decision = self.pending_man_decisions[task_id]
        decision_type = decision.get("decision")

        if decision_type == "APPROVE":
            workflow.logger.info(f"✅ Step {step_id} approved by operator")
            return
        elif decision_type == "DENY":
            workflow.logger.warning(f"❌ Step {step_id} denied by operator")
            raise ApplicationError(f"Step {step_id} denied by operator", non_retryable=True)
        elif decision_type == "CANCEL_WORKFLOW":
            workflow.logger.warning(f"🚫 Workflow cancelled by operator decision on step {step_id}")
            self.workflow_cancelled = True
            raise ApplicationError("Workflow cancelled by operator", non_retryable=True)
        elif decision_type == "MODIFY":
            workflow.logger.info(f"🔧 Step {step_id} modified by operator")
            return
        else:
            workflow.logger.warning(f"⚠️ Unknown decision type for step {step_id}: {decision_type}")
            # Default to approval for unknown types
            return

    # ============================================================================
    # MAN MODE SIGNAL HANDLERS (Human Override Controls)
    # ============================================================================

    @workflow.signal
    async def pause_workflow(self, reason: str) -> None:
        """
        Signal to pause workflow execution.

        Args:
            reason: Reason for pausing
        """
        workflow.logger.warning(f"🛑 Workflow paused by signal: {reason}")
        self.workflow_paused = True

    @workflow.signal
    async def resume_workflow(self) -> None:
        """
        Signal to resume workflow execution.
        """
        workflow.logger.info("▶️ Workflow resumed by signal")
        self.workflow_paused = False

    @workflow.signal
    async def cancel_workflow(self, reason: str) -> None:
        """
        Signal to cancel workflow execution.

        Args:
            reason: Reason for cancellation
        """
        workflow.logger.warning(f"❌ Workflow cancelled by signal: {reason}")
        self.workflow_cancelled = True

    @workflow.signal
    async def force_man_mode(self, scope: str, step_ids: Optional[list[str]] = None) -> None:
        """
        Signal to force MAN Mode approval for steps.

        Args:
            scope: "ALL" or "STEPS"
            step_ids: List of step IDs if scope is "STEPS"
        """
        if scope == "ALL":
            self.force_man_mode_all = True
            workflow.logger.warning("🔒 MAN Mode forced for ALL steps")
        elif scope == "STEPS" and step_ids:
            self.force_man_mode_steps.update(step_ids)
            workflow.logger.warning(f"🔒 MAN Mode forced for steps: {step_ids}")

    @workflow.update
    async def submit_man_decision(self, task_id: str, decision_payload: dict[str, Any]) -> None:
        """
        Update to submit a decision for a MAN task.

        Args:
            task_id: MAN task identifier
            decision_payload: Decision details
        """
        workflow.logger.info(f"📋 MAN decision submitted for task {task_id}")
        self.pending_man_decisions[task_id] = decision_payload

    async def rollback(self) -> list[dict[str, Any]]:
        """
        Execute all compensations in reverse order (LIFO).

        Returns:
            List of compensation results (for audit trail)

        Note: Compensations are best-effort. Failures are logged but don't block rollback.
        """
        if self.rollback_executed:
            workflow.logger.warning("Saga rollback already executed - skipping")
            return []

        self.rollback_executed = True

        if not self.compensation_stack:
            workflow.logger.info("No compensations to execute")
            return []

        workflow.logger.warning(
            f"🔄 Starting Saga rollback ({len(self.compensation_stack)} compensations)"
        )

        results = []
        # Execute in reverse order (LIFO)
        for compensation in reversed(self.compensation_stack):
            try:
                result = await self.workflow_instance._execute_activity(
                    compensation.activity_name,
                    compensation.input,
                    compensation.step_id,
                    is_compensation=True,
                )
                results.append({"step_id": compensation.step_id, "success": True, "result": result})
                workflow.logger.info(f"✓ Compensation succeeded: {compensation.activity_name}")

            except Exception as e:
                # Log but continue (best-effort rollback)
                workflow.logger.error(
                    f"✗ Compensation failed: {compensation.activity_name} - {str(e)}"
                )
                results.append({"step_id": compensation.step_id, "success": False, "error": str(e)})

        workflow.logger.info(f"✓ Saga rollback complete ({len(results)} compensations executed)")
        return results

    @staticmethod
    def _inject_result_values(
        compensation_input: dict[str, Any], result: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Inject values from activity result into compensation input.

        Example:
            result = {"booking_id": "BK123", "price": 500}
            comp_input = {"booking_id": "{result.booking_id}"}
            → {"booking_id": "BK123"}
        """
        injected = {}
        for key, value in compensation_input.items():
            if isinstance(value, str) and value.startswith("{result."):
                # Extract field name: "{result.booking_id}" → "booking_id"
                field_name = value.replace("{result.", "").replace("}", "")
                injected[key] = result.get(field_name, value)
            else:
                injected[key] = value
        return injected


# ============================================================================
# AGENT WORKFLOW (Event Sourcing + Saga)
# ============================================================================


@workflow.defn
class AgentWorkflow:
    """
    AI Agent Orchestration Workflow with Event Sourcing and Saga Pattern.

    This workflow orchestrates multi-step agent tasks with:
    - Semantic caching for latency reduction
    - Event sourcing for state management
    - Saga pattern for compensation
    - Reflexion-based error recovery

    Workflow Lifecycle:
    1. Receive goal (GoalReceived event)
    2. Check semantic cache
    3. Generate plan (cache hit → inject params, cache miss → LLM call)
    4. Execute plan steps (DAG traversal)
    5. Handle failures (retry → reflexion → saga rollback)
    6. Complete or fail (terminal state)

    Why Event Sourcing:
    - Temporal replays workflows from history on worker crashes
    - Event-based state ensures deterministic replay
    - Complete audit trail (every decision recorded)
    - Easy debugging (replay to any point in time)

    Continue-As-New:
    - Temporal limits workflow history to ~50K events
    - For long-running workflows, we snapshot state and start fresh
    - Think: Git history squashing or log compaction
    - Triggered when event list exceeds MAX_HISTORY_SIZE
    """

    def __init__(self) -> None:
        """Initialize workflow state."""
        # Event sourcing: State reconstructed from events
        self.events: list[AgentEvent] = []

        # Saga context for compensations
        self.saga: Optional[SagaContext] = None

        # Derived state (computed from events)
        self.goal: str = ""
        self.user_id: str = ""
        self.plan_id: str = ""
        self.plan_steps: list[dict[str, Any]] = []
        self.step_results: dict[str, Any] = {}
        self.failed_step_id: str = ""

        # MAN Mode state
        self.man_mode_enabled: bool = True  # Can be controlled via env/config
        self.workflow_paused: bool = False
        self.workflow_cancelled: bool = False
        self.force_man_mode_all: bool = False  # Force approval for all steps
        self.force_man_mode_steps: set[str] = set()  # Force approval for specific steps
        self.pending_man_decisions: dict[str, dict[str, Any]] = {}  # task_id -> decision payload

        # Continue-as-new threshold
        self.MAX_HISTORY_SIZE = 1000

    @workflow.run
    async def run(
        self, goal: str, user_id: str, context: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """
        Main workflow entry point.

        Args:
            goal: User's natural language goal
            user_id: User ID
            context: Additional context (preferences, history, etc.)

        Returns:
            Workflow result with plan execution details

        Raises:
            ApplicationError: If workflow fails after exhausting retries
        """
        correlation_id = workflow.info().workflow_id

        # Initialize Saga context
        self.saga = SagaContext(workflow_instance=self)

        try:
            # 1. Record goal received
            await self._append_event(
                GoalReceived(
                    correlation_id=correlation_id,
                    goal=goal,
                    user_id=user_id,
                    context=context,
                )
            )

            # 2. Try semantic cache lookup
            cached_plan = await self._check_semantic_cache(goal)

            # 3. Generate plan (use cache or call LLM)
            if cached_plan:
                template_id = cached_plan["template_id"]
                workflow.logger.info(f"✓ Cache HIT - using cached plan: {template_id}")
                await self._append_event(
                    PlanGenerated(
                        correlation_id=correlation_id,
                        plan_id=cached_plan["plan_id"],
                        steps=cached_plan["steps"],
                        cache_hit=True,
                        template_id=cached_plan.get("template_id"),
                    )
                )
            else:
                workflow.logger.info("✗ Cache MISS - generating fresh plan via LLM")
                plan = await self._generate_plan_with_llm(goal, context or {})
                await self._append_event(
                    PlanGenerated(
                        correlation_id=correlation_id,
                        plan_id=plan["plan_id"],
                        steps=plan["steps"],
                        cache_hit=False,
                    )
                )

            # 4. Execute plan steps (DAG traversal)
            await self._execute_plan()

            # 5. Workflow succeeded
            workflow_result = await self._handle_success()

            return workflow_result

        except Exception as e:
            # 6. Workflow failed - trigger Saga rollback
            workflow.logger.error(f"✗ Workflow failed: {str(e)}")
            workflow_result = await self._handle_failure(str(e))

            raise ApplicationError(
                f"Workflow failed: {str(e)}",
                non_retryable=True,
                details=workflow_result,
            ) from e

    async def _check_semantic_cache(self, goal: str) -> Optional[dict[str, Any]]:
        """
        Check semantic cache for existing plan template.

        This is an Activity (not direct Redis call) to maintain determinism.
        """
        try:
            result = await workflow.execute_activity(
                "check_semantic_cache",
                args=[goal],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )
            return result if result else None
        except ActivityError:
            workflow.logger.warning("Semantic cache lookup failed - proceeding without cache")
            return None

    async def _generate_plan_with_llm(self, goal: str, context: dict[str, Any]) -> dict[str, Any]:
        """
        Generate execution plan using LLM.

        This MUST be an Activity (not direct LLM call) because:
        - LLM calls are non-deterministic (same input ≠ same output)
        - Temporal replays workflows → direct calls would re-execute
        - Activities are recorded in history → replay uses cached result

        The activity also stores the plan in semantic cache for future hits.
        """
        result = await workflow.execute_activity(
            "generate_plan_with_llm",
            args=[goal, context],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=1),
                backoff_coefficient=2.0,
            ),
        )
        return result

    async def _execute_plan(self) -> None:
        """
        Execute plan steps in dependency order (DAG traversal with parallel execution).

        DAG Execution Algorithm:
        1. Build dependency graph from step.depends_on fields
        2. Topological sort to find execution levels
        3. Execute steps at same level in parallel via asyncio.gather
        4. Pass results to dependent steps
        """
        # Build step lookup and dependency graph
        step_lookup = {}
        dependencies: dict[str, list[str]] = defaultdict(list)
        dependents: dict[str, list[str]] = defaultdict(list)

        for idx, step in enumerate(self.plan_steps):
            step_id = step.get("id", f"step_{idx}")
            step_lookup[step_id] = step
            deps = step.get("depends_on", [])
            if isinstance(deps, str):
                deps = [deps]
            dependencies[step_id] = deps
            for dep in deps:
                dependents[dep].append(step_id)

        # Calculate in-degrees for topological sort
        in_degree = {step_id: len(deps) for step_id, deps in dependencies.items()}

        # Find all steps with no dependencies (ready to execute)
        ready_queue = [step_id for step_id, degree in in_degree.items() if degree == 0]
        executed = set()
        level = 1

        workflow.logger.info(
            f"🔀 DAG Execution: {len(self.plan_steps)} steps, "
            f"{len(ready_queue)} initial parallel steps"
        )

        while ready_queue:
            # Execute all ready steps in parallel
            if len(ready_queue) > 1:
                workflow.logger.info(
                    f"▶ Level {level}: Executing {len(ready_queue)} steps in PARALLEL: "
                    f"{ready_queue}"
                )
            else:
                workflow.logger.info(f"▶ Level {level}: Executing step: {ready_queue[0]}")

            # Create coroutines for parallel execution
            parallel_tasks = [
                self._execute_single_step(step_lookup[step_id], step_id) for step_id in ready_queue
            ]

            # Execute in parallel and collect results
            results = await asyncio.gather(*parallel_tasks, return_exceptions=True)

            # Process results and handle failures
            next_ready = []
            for step_id, result in zip(ready_queue, results, strict=True):
                if isinstance(result, Exception):
                    # Step failed - trigger rollback
                    self.failed_step_id = step_id
                    raise result

                # Mark as executed and update dependents
                executed.add(step_id)
                self.step_results[step_id] = result

                # Check if any dependents are now ready
                for dependent_id in dependents[step_id]:
                    in_degree[dependent_id] -= 1
                    if in_degree[dependent_id] == 0 and dependent_id not in executed:
                        next_ready.append(dependent_id)

            ready_queue = next_ready
            level += 1

        # Verify all steps executed (detect cycles)
        if len(executed) != len(self.plan_steps):
            missing = set(step_lookup.keys()) - executed
            raise ApplicationError(
                f"DAG cycle detected or missing dependencies: {missing}",
                non_retryable=True,
            )

        workflow.logger.info(
            f"✓ DAG execution complete: {len(executed)} steps in {level - 1} levels"
        )

    async def _execute_single_step(self, step: dict[str, Any], step_id: str) -> dict[str, Any]:
        """
        Execute a single step with MAN Mode gate and compensation registration.

        MAN Mode Flow:
        1. Check workflow pause/cancel signals
        2. Build ActionIntent from step
        3. Check backlog limits
        4. Triage risk level
        5. Create MAN task if RED lane
        6. Wait for decision if task created
        7. Execute step with decision modifications
        8. Register compensation

        Args:
            step: Step definition from plan
            step_id: Unique step identifier

        Returns:
            Step execution result

        Raises:
            ActivityError: If step fails after retries
            ApplicationError: If workflow cancelled or decision denied
        """
        step_name = step.get("name", step_id)
        workflow.logger.info(f"  ⚙ Starting step: {step_name}")

        # 1. Check workflow control signals
        if self.workflow_cancelled:
            raise ApplicationError("Workflow cancelled by operator", non_retryable=True)

        if self.workflow_paused:
            workflow.logger.info(f"  ⏸️ Step {step_id} paused - waiting for resume signal")
            await workflow.wait_condition(lambda: not self.workflow_paused)
            workflow.logger.info(f"  ▶️ Step {step_id} resumed")

        # 2. Build ActionIntent from step
        intent = ActionIntent(
            tenant_id=self._get_tenant_id(),  # Extract from workflow context
            workflow_id=workflow.info().workflow_id,
            run_id=self.plan_id,
            step_id=step_id,
            tool_name=step["tool"],
            tool_params=step.get("input", {}),
            flags=self._extract_step_flags(step),  # Extract flags from step metadata
        )

        # 3. Check backlog if MAN Mode enabled
        if self.man_mode_enabled:
            try:
                backlog_result = await workflow.execute_activity(
                    "backlog_check",
                    args=[intent.tenant_id],
                    start_to_close_timeout=timedelta(seconds=5),
                )

                if backlog_result.get("overloaded"):
                    action = backlog_result.get("action")
                    if action == "BLOCK_NEW":
                        workflow.logger.warning(f"  🚫 Step {step_id} blocked due to backlog overload")
                        raise ApplicationError(
                            f"Step blocked due to operator backlog ({backlog_result.get('pending_count')} pending tasks)",
                            non_retryable=True
                        )
                    elif action == "FORCE_PAUSE":
                        workflow.logger.warning(f"  ⏸️ Workflow paused due to backlog overload")
                        self.workflow_paused = True
                        await workflow.wait_condition(lambda: not self.workflow_paused)

            except ActivityError:
                # Backlog check failure - continue (fail-safe)
                workflow.logger.warning("Backlog check failed - proceeding without overload protection")

        # 4. Triage risk level if MAN Mode enabled
        task_id = None
        if self.man_mode_enabled:
            try:
                triage_result = await workflow.execute_activity(
                    "risk_triage",
                    args=[intent.model_dump(), self._get_workflow_key()],
                    start_to_close_timeout=timedelta(seconds=5),
                )

                # Force RED if MAN Mode forced for this step
                if self.force_man_mode_all or step_id in self.force_man_mode_steps:
                    triage_result["lane"] = "RED"
                    triage_result["reasons"].append("MAN Mode forced by operator")

                workflow.logger.info(f"  🎯 Step {step_id} triaged: {triage_result['lane']} ({triage_result['risk_score']:.2f})")

                # 5. Create MAN task if RED lane
                if triage_result["lane"] == "RED":
                    task_result = await workflow.execute_activity(
                        "create_man_task",
                        args=[intent.model_dump(), triage_result],
                        start_to_close_timeout=timedelta(seconds=10),
                    )

                    if task_result:
                        task_id = task_result["id"]
                        workflow.logger.warning(f"  🛡️ Step {step_id} requires approval (task: {task_id})")

                        # 6. Wait for decision
                        await self._wait_for_man_decision(task_id, step_id)

                        workflow.logger.info(f"  ✅ Step {step_id} approved - proceeding with execution")
                    else:
                        workflow.logger.info(f"  ⚠️ Step {step_id} RED but task creation skipped")

            except ActivityError as e:
                # Triage failure - fail-safe to allow execution
                workflow.logger.warning(f"Risk triage failed for step {step_id}: {e} - proceeding without approval")

        # 7. Apply decision modifications if any
        modified_params = step.get("input", {}).copy()
        if task_id and task_id in self.pending_man_decisions:
            decision = self.pending_man_decisions[task_id]
            if decision.get("decision") == "MODIFY" and decision.get("modified_params"):
                modified_params.update(decision["modified_params"])
                workflow.logger.info(f"  🔧 Step {step_id} parameters modified by operator")

        # Record tool call request (with potentially modified params)
        await self._append_event(
            ToolCallRequested(
                correlation_id=workflow.info().workflow_id,
                tool_name=step["tool"],
                tool_input=modified_params,
                step_id=step_id,
                compensation_activity=step.get("compensation"),
            )
        )

        try:
            # 8. Execute step with compensation
            result = await self.saga.execute_with_compensation(
                activity_name=step["tool"],
                activity_input=modified_params,
                compensation_activity=step.get("compensation"),
                compensation_input=step.get("compensation_input"),
                step_id=step_id,
            )

            # Record success
            await self._append_event(
                ToolResultReceived(
                    correlation_id=workflow.info().workflow_id,
                    tool_name=step["tool"],
                    step_id=step_id,
                    success=True,
                    result=result,
                )
            )

            workflow.logger.info(f"  ✓ Completed step: {step_name}")
            return result

        except ActivityError as e:
            # Record failure
            await self._append_event(
                ToolResultReceived(
                    correlation_id=workflow.info().workflow_id,
                    tool_name=step["tool"],
                    step_id=step_id,
                    success=False,
                    error=str(e),
                )
            )
            workflow.logger.error(f"  ✗ Failed step: {step_name} - {str(e)}")
            raise

    async def _handle_success(self) -> dict[str, Any]:
        """Handle successful workflow completion."""
        workflow.logger.info("✓ Workflow completed successfully")

        result = {
            "status": "completed",
            "plan_id": self.plan_id,
            "steps_executed": len(self.plan_steps),
            "results": self.step_results,
        }

        await self._append_event(
            WorkflowCompleted(
                correlation_id=workflow.info().workflow_id,
                plan_id=self.plan_id,
                total_steps=len(self.plan_steps),
                duration_seconds=0.0,  # TODO: Calculate from start time
                final_result=result,
            )
        )

        return result

    async def _handle_failure(self, error_message: str) -> dict[str, Any]:
        """Handle workflow failure with Saga rollback."""
        workflow.logger.error(f"✗ Handling workflow failure: {error_message}")

        # Execute compensations
        compensation_results = await self.saga.rollback()

        result = {
            "status": "failed",
            "plan_id": self.plan_id,
            "failed_step_id": self.failed_step_id,
            "error": error_message,
            "compensation_executed": True,
            "compensation_results": compensation_results,
        }

        await self._append_event(
            WorkflowFailed(
                correlation_id=workflow.info().workflow_id,
                plan_id=self.plan_id,
                failed_step_id=self.failed_step_id,
                error_message=error_message,
                compensation_executed=True,
                compensation_results=compensation_results,
            )
        )

        return result

    async def _append_event(self, event: AgentEvent) -> None:
        """
        Append event to event log (Event Sourcing).

        Also checks for continue-as-new threshold to prevent runaway history.

        Why continue-as-new:
        - Temporal workflows store full event history
        - Large histories (>50K events) cause performance degradation
        - Continue-as-new snapshots state and starts fresh workflow
        - Old history is archived, new workflow continues from checkpoint
        """
        self.events.append(event)

        # Update derived state based on event type
        if isinstance(event, GoalReceived):
            self.goal = event.goal
            self.user_id = event.user_id
        elif isinstance(event, PlanGenerated):
            self.plan_id = event.plan_id
            self.plan_steps = event.steps

        # Check for continue-as-new threshold
        if len(self.events) >= self.MAX_HISTORY_SIZE:
            workflow.logger.warning(
                f"Event history size ({len(self.events)}) exceeded threshold "
                f"({self.MAX_HISTORY_SIZE}) - triggering continue-as-new"
            )
            # await self._continue_as_new()  # TODO: Implement snapshotting

    async def _execute_activity(
        self,
        activity_name: str,
        activity_input: dict[str, Any],
        step_id: str,
        is_compensation: bool = False,
    ) -> dict[str, Any]:
        """
        Execute Temporal activity with retry policy.

        Activities are the ONLY way to perform I/O in workflows (determinism requirement).
        """
        timeout = timedelta(seconds=30)
        if is_compensation:
            timeout = timedelta(seconds=15)  # Shorter timeout for compensations

        result = await workflow.execute_activity(
            activity_name,
            args=[activity_input],
            start_to_close_timeout=timeout,
            retry_policy=RetryPolicy(
                maximum_attempts=3 if not is_compensation else 2,
                initial_interval=timedelta(seconds=1),
                backoff_coefficient=2.0,
                maximum_interval=timedelta(seconds=10),
            ),
        )

        return result
