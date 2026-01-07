"""
MAN Mode Temporal Activities.

Activities for human override workflow approvals:
- risk_triage: Evaluate action intent for risk level
- create_man_task: Create pending approval task (idempotent)
- resolve_man_task: Submit decision on task (idempotent)
- backlog_check: Check if tenant has too many pending tasks

All activities follow Temporal patterns: try/except with ApplicationError for retries,
audit logging, and deterministic behavior.
"""

import json
from typing import Any, Dict, Optional

from temporalio import activity
from temporalio.exceptions import ApplicationError

from ..models.audit import AuditAction, AuditResourceType, AuditStatus, log_audit_event
from ..models.man_mode import (
    ActionIntent,
    ManDecision,
    ManDecisionPayload,
    ManLane,
    ManTask,
    RiskTriageResult,
    get_policy_engine,
)
from ..providers.database.factory import get_database_provider

# ============================================================================
# MAN MODE ACTIVITIES
# ============================================================================


@activity.defn(name="risk_triage")
async def risk_triage(
    intent_data: Dict[str, Any],
    workflow_key: Optional[str] = None,
    free_text_signals: Optional[list[str]] = None
) -> Dict[str, Any]:
    """
    Triage an action intent for risk assessment.

    This activity is deterministic - same inputs always produce same output.
    No external API calls or non-deterministic operations.

    Args:
        intent_data: ActionIntent as dict (from workflow)
        workflow_key: Optional workflow-specific policy key
        free_text_signals: Optional text signals for risk analysis

    Returns:
        RiskTriageResult as dict for workflow consumption

    Raises:
        ApplicationError: For retryable failures (database issues)
    """
    activity.logger.info(f"Triaging action intent for tool: {intent_data.get('tool_name')}")

    success = False
    error_msg = None

    try:
        # Convert dict back to ActionIntent model
        intent = ActionIntent(**intent_data)

        # Get policy engine (with in-memory caching)
        engine = get_policy_engine()

        # Perform deterministic triage
        result = engine.triage_intent(intent, workflow_key, free_text_signals)

        activity.logger.info(
            f"✓ Triage complete: {result.lane} (score: {result.risk_score:.2f})"
        )

        # Audit the triage decision
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.SECURITY_ASSESSMENT,
            resource_type=AuditResourceType.WORKFLOW,
            resource_id=f"{intent.workflow_id}:{intent.step_id}",
            status=AuditStatus.SUCCESS,
            metadata={
                "tool_name": intent.tool_name,
                "lane": result.lane,
                "risk_score": result.risk_score,
                "reasons": result.reasons,
                "workflow_key": workflow_key,
            },
        )

        # Return as dict for workflow
        return result.model_dump()

    except Exception as e:
        error_msg = str(e)
        activity.logger.error(f"Risk triage failed: {error_msg}")

        # Audit failure
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.SECURITY_ASSESSMENT,
            resource_type=AuditResourceType.WORKFLOW,
            resource_id=f"{intent_data.get('workflow_id', 'unknown')}:{intent_data.get('step_id', 'unknown')}",
            status=AuditStatus.FAILURE,
            metadata={"error": error_msg},
        )

        # Use ApplicationError for retryable failures
        raise ApplicationError(f"Risk triage failed: {error_msg}", non_retryable=False) from e


@activity.defn(name="create_man_task")
async def create_man_task(
    intent_data: Dict[str, Any],
    triage_result_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Create a pending MAN task (idempotent).

    Uses deterministic idempotency key to prevent duplicates.
    Only creates task if triage result indicates RED lane.

    Args:
        intent_data: ActionIntent as dict
        triage_result_data: RiskTriageResult as dict

    Returns:
        Created ManTask as dict, or None if no task created

    Raises:
        ApplicationError: For retryable failures
    """
    intent = ActionIntent(**intent_data)
    triage_result = RiskTriageResult(**triage_result_data)

    activity.logger.info(
        f"Creating MAN task for {intent.tool_name} (lane: {triage_result.lane})"
    )

    # Only create task for RED lane
    if triage_result.lane != ManLane.RED:
        activity.logger.info(f"Skipping task creation - lane is {triage_result.lane}")
        return None

    success = False
    error_msg = None
    task_id = None

    try:
        # Build deterministic idempotency key
        # Same intent should always produce same key
        key_components = [
            intent.tenant_id,
            intent.workflow_id,
            intent.step_id or "",
            intent.tool_name,
            json.dumps(intent.tool_params, sort_keys=True),  # Deterministic serialization
        ]
        idempotency_key = "|".join(key_components)

        # Create task record
        task = ManTask(
            tenant_id=intent.tenant_id,
            workflow_id=intent.workflow_id,
            run_id=intent.run_id,
            step_id=intent.step_id,
            tool_name=intent.tool_name,
            idempotency_key=idempotency_key,
            risk_score=triage_result.risk_score,
            risk_reasons=triage_result.reasons,
            intent=intent.model_dump(),  # Store redacted intent
        )

        # Get database provider
        db = get_database_provider()

        # Upsert task (idempotent)
        created_task = await db.upsert(
            table="man_tasks",
            record=task.model_dump(exclude_unset=True),
            conflict_columns=["idempotency_key"]
        )

        task_id = created_task["id"]

        activity.logger.info(f"✓ MAN task created: {task_id}")

        # Audit task creation
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.SECURITY_INCIDENT,
            resource_type=AuditResourceType.WORKFLOW,
            resource_id=f"{intent.workflow_id}:{intent.step_id}",
            status=AuditStatus.SUCCESS,
            metadata={
                "task_id": task_id,
                "tool_name": intent.tool_name,
                "risk_score": triage_result.risk_score,
                "idempotency_key": idempotency_key,
            },
        )

        return created_task

    except Exception as e:
        error_msg = str(e)
        activity.logger.error(f"MAN task creation failed: {error_msg}")

        # Audit failure
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.SECURITY_INCIDENT,
            resource_type=AuditResourceType.WORKFLOW,
            resource_id=f"{intent.workflow_id}:{intent.step_id}",
            status=AuditStatus.FAILURE,
            metadata={
                "tool_name": intent.tool_name,
                "error": error_msg,
                "task_id": task_id,
            },
        )

        raise ApplicationError(f"MAN task creation failed: {error_msg}", non_retryable=False) from e


@activity.defn(name="resolve_man_task")
async def resolve_man_task(
    task_id: str,
    decision_payload_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Resolve a MAN task with a decision (idempotent).

    Updates task status and stores decision. Safe to call multiple times.

    Args:
        task_id: Task identifier
        decision_payload_data: ManDecisionPayload as dict

    Returns:
        Updated ManTask as dict

    Raises:
        ApplicationError: For retryable failures
    """
    decision_payload = ManDecisionPayload(**decision_payload_data)

    activity.logger.info(
        f"Resolving MAN task {task_id} with decision: {decision_payload.decision}"
    )

    success = False
    error_msg = None

    try:
        # Get database provider
        db = get_database_provider()

        # Check if task already resolved (idempotency)
        existing_task = await db.select_one(
            table="man_tasks",
            filters={"id": task_id},
            select_fields="id,status,reviewer_id,decision"
        )

        if not existing_task:
            raise ApplicationError(f"MAN task {task_id} not found", non_retryable=True)

        # If already resolved, return existing state
        if existing_task["status"] != "PENDING":
            activity.logger.info(f"Task {task_id} already resolved with status: {existing_task['status']}")
            # Return full task data
            full_task = await db.select_one(table="man_tasks", filters={"id": task_id})
            return full_task

        # Prepare decision data
        decision_data = {
            "decision": decision_payload.decision,
            "reason": decision_payload.reason,
            "reviewer_id": decision_payload.reviewer_id,
            "modified_params": decision_payload.modified_params,
        }

        # Update task
        updates = {
            "status": "APPROVED" if decision_payload.decision == ManDecision.APPROVE else
                     "DENIED" if decision_payload.decision == ManDecision.DENY else
                     "MODIFIED" if decision_payload.decision == ManDecision.MODIFY else
                     "CANCELLED",
            "reviewer_id": decision_payload.reviewer_id,
            "decision": decision_data,
        }

        updated_task = await db.update(
            table="man_tasks",
            filters={"id": task_id, "status": "PENDING"},  # Only update if still pending
            updates=updates
        )

        if not updated_task:
            # Task was already resolved by another process
            activity.logger.info(f"Task {task_id} was already resolved")
            full_task = await db.select_one(table="man_tasks", filters={"id": task_id})
            return full_task


        activity.logger.info(f"✓ MAN task {task_id} resolved: {decision_payload.decision}")

        # Audit decision
        await log_audit_event(
            actor_id=decision_payload.reviewer_id,
            action=AuditAction.SECURITY_DECISION,
            resource_type=AuditResourceType.WORKFLOW,
            resource_id=task_id,
            status=AuditStatus.SUCCESS,
            metadata={
                "decision": decision_payload.decision,
                "reason": decision_payload.reason,
                "has_modifications": decision_payload.modified_params is not None,
            },
        )

        return updated_task

    except ApplicationError:
        # Re-raise ApplicationError as-is
        raise
    except Exception as e:
        error_msg = str(e)
        activity.logger.error(f"MAN task resolution failed: {error_msg}")

        # Audit failure
        await log_audit_event(
            actor_id=decision_payload.reviewer_id,
            action=AuditAction.SECURITY_DECISION,
            resource_type=AuditResourceType.WORKFLOW,
            resource_id=task_id,
            status=AuditStatus.FAILURE,
            metadata={"error": error_msg},
        )

        raise ApplicationError(f"MAN task resolution failed: {error_msg}", non_retryable=False) from e


@activity.defn(name="backlog_check")
async def backlog_check(tenant_id: str) -> Dict[str, Any]:
    """
    Check if tenant has exceeded pending task limits.

    Used to implement degrade behavior when operator backlog is too large.

    Args:
        tenant_id: Tenant identifier

    Returns:
        {
            "overloaded": bool,
            "pending_count": int,
            "action": str  # "BLOCK_NEW", "FORCE_PAUSE", or "AUTO_DENY"
        }

    Raises:
        ApplicationError: For retryable failures
    """
    activity.logger.info(f"Checking MAN task backlog for tenant: {tenant_id}")

    success = False
    error_msg = None

    try:
        # Get policy engine to check limits
        engine = get_policy_engine()
        policy = engine.policy  # Access policy directly

        # Get database provider
        db = get_database_provider()

        # Count pending tasks for tenant
        pending_tasks = await db.select(
            table="man_tasks",
            filters={"tenant_id": tenant_id, "status": "PENDING"}
        )

        pending_count = len(pending_tasks)
        max_pending = policy.max_pending_per_tenant

        overloaded = pending_count >= max_pending

        result = {
            "overloaded": overloaded,
            "pending_count": pending_count,
            "max_pending": max_pending,
            "action": policy.degrade_behavior if overloaded else None,
        }

        if overloaded:
            activity.logger.warning(
                f"⚠️ Tenant {tenant_id} overloaded: {pending_count}/{max_pending} pending tasks"
            )

            # Audit overload condition
            await log_audit_event(
                actor_id="orchestrator",
                action=AuditAction.SECURITY_INCIDENT,
                resource_type=AuditResourceType.TENANT,
                resource_id=tenant_id,
                status=AuditStatus.SUCCESS,
                metadata={
                    "pending_count": pending_count,
                    "max_pending": max_pending,
                    "degrade_action": policy.degrade_behavior,
                },
            )
        else:
            activity.logger.info(f"✓ Tenant {tenant_id} backlog OK: {pending_count}/{max_pending}")

        return result

    except Exception as e:
        error_msg = str(e)
        activity.logger.error(f"Backlog check failed: {error_msg}")

        # For backlog checks, we don't want to block workflows on failures
        # Return safe defaults (not overloaded)
        activity.logger.warning(f"Backlog check failed, returning safe defaults: {error_msg}")

        return {
            "overloaded": False,
            "pending_count": 0,
            "max_pending": 50,
            "action": None,
            "error": error_msg,
        }
