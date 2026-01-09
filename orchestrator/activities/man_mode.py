"""
MAN Mode Activities: Risk triage and approval task persistence.

These activities handle the MAN (Manual Approval Node) safety gate:
1. risk_triage: Evaluate risk level of proposed action
2. create_man_task: Persist approval task to database + send notifications
3. resolve_man_task: Update task with human decision
4. get_man_task: Retrieve task status (for polling)
5. notify_man_task: Send push notifications for pending approvals

Design Principles:
- Stateless: Each call is independent
- Idempotent: Safe to retry (uses idempotency_key)
- Retryable: Transient failures use non_retryable=False
- Non-blocking: Notifications are fire-and-forget
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from temporalio import activity
from temporalio.exceptions import ApplicationError

from models.man_mode import (
    ActionIntent,
    ManTaskDecision,
    ManTaskStatus,
    create_idempotency_key,
)
from policies.man_policy import ManPolicy
from providers.database.factory import get_database_provider
from services.notifications import get_notification_service

# ============================================================================
# RISK TRIAGE ACTIVITY
# ============================================================================


@activity.defn(name="risk_triage")
async def risk_triage(intent_data: dict[str, Any]) -> dict[str, Any]:
    """
    Evaluate risk level of proposed action.

    Pure policy logic - no side effects, no database access.
    Safe to retry without consequences.

    Args:
        intent_data: ActionIntent as dict with keys:
            - tool_name: str
            - params: dict
            - workflow_id: str
            - step_id: str (optional)
            - irreversible: bool (optional)
            - context: dict (optional)

    Returns:
        RiskTriageResult as dict with keys:
            - lane: "GREEN"|"YELLOW"|"RED"|"BLOCKED"
            - reason: str
            - requires_approval: bool
            - risk_factors: list[str]
            - suggested_timeout_hours: int

    Raises:
        ApplicationError: If intent validation fails (non-retryable)
    """
    try:
        # Validate and parse intent
        intent = ActionIntent(**intent_data)

        # Run policy evaluation
        policy = ManPolicy()
        result = policy.triage(intent)

        activity.logger.info(
            f"Risk triage for '{intent.tool_name}': {result.lane.value} ({result.reason})"
        )

        return result.model_dump()

    except Exception as e:
        activity.logger.error(f"Risk triage failed: {str(e)}")
        raise ApplicationError(
            f"Risk triage failed: {str(e)}",
            non_retryable=True,  # Validation errors won't fix on retry
        ) from e


# ============================================================================
# CREATE MAN TASK ACTIVITY
# ============================================================================


@activity.defn(name="create_man_task")
async def create_man_task(params: dict[str, Any]) -> dict[str, Any]:
    """
    Persist approval task to database.

    Idempotent via idempotency_key upsert - safe to call multiple times
    for the same workflow step.

    Args:
        params: Dict with keys:
            - workflow_id: str
            - step_id: str
            - intent: dict (ActionIntent)
            - triage_result: dict (RiskTriageResult)
            - timeout_hours: int (optional, default 24)

    Returns:
        Dict with keys:
            - task_id: str (UUID)
            - idempotency_key: str
            - status: str
            - created: bool (True if new, False if existing)

    Raises:
        ApplicationError: Database errors (retryable for transient issues)
    """
    try:
        workflow_id = params["workflow_id"]
        step_id = params.get("step_id", "")
        intent_data = params["intent"]
        triage_data = params.get("triage_result", {})
        timeout_hours = params.get("timeout_hours", 24)

        # Create idempotency key
        idempotency_key = create_idempotency_key(workflow_id, step_id)

        # Calculate expiration (timezone-aware)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=timeout_hours)).isoformat()

        # Get database provider
        db = get_database_provider()

        # Build record for upsert
        record = {
            "idempotency_key": idempotency_key,
            "workflow_id": workflow_id,
            "step_id": step_id,
            "status": ManTaskStatus.PENDING.value,
            "intent": intent_data,
            "triage_result": triage_data,
            "expires_at": expires_at,
        }

        # Check if task already exists (for idempotency)
        existing = await db.get(
            table="man_tasks",
            query_params={"idempotency_key": idempotency_key},
        )

        is_new_task = not existing

        if is_new_task:
            # Insert new task
            result = await db.insert(table="man_tasks", record=record)
        else:
            # Return existing task (idempotent)
            result = existing[0]

        task_id = str(result["id"])

        status_msg = "created" if is_new_task else "retrieved"
        activity.logger.info(f"MAN task {status_msg}: {task_id} for workflow {workflow_id}")

        # Send notifications only for NEW tasks (idempotent - won't resend on retry)
        if is_new_task:
            try:
                notification_service = get_notification_service()
                await notification_service.notify_task_created(
                    task_id=task_id,
                    workflow_id=workflow_id,
                    step_id=step_id,
                    intent=intent_data,
                    triage_result=triage_data,
                    expires_at=expires_at,
                )
                activity.logger.info(f"Notifications sent for MAN task {task_id}")
            except Exception as notify_err:
                # Fire-and-forget: log but don't fail the activity
                activity.logger.warning(
                    f"Failed to send notifications for MAN task {task_id}: {notify_err}"
                )

        return {
            "task_id": task_id,
            "idempotency_key": idempotency_key,
            "status": result.get("status", ManTaskStatus.PENDING.value),
            "created": is_new_task,
        }

    except ApplicationError:
        raise
    except Exception as e:
        activity.logger.error(f"Failed to create MAN task: {str(e)}")
        raise ApplicationError(
            f"Database error in create_man_task: {str(e)}",
            non_retryable=False,  # Retryable for transient DB issues
        ) from e


# ============================================================================
# RESOLVE MAN TASK ACTIVITY
# ============================================================================


@activity.defn(name="resolve_man_task")
async def resolve_man_task(params: dict[str, Any]) -> dict[str, Any]:
    """
    Update task with human decision.

    Called when a human approves or denies a MAN task.
    The workflow waiting on this task will be signaled to continue.

    Args:
        params: Dict with keys:
            - task_id: str (UUID)
            - status: "APPROVED"|"DENIED"
            - reason: str (optional)
            - decided_by: str (user ID)
            - metadata: dict (optional)

    Returns:
        Dict with keys:
            - success: bool
            - task_id: str
            - status: str
            - workflow_id: str (for signaling)

    Raises:
        ApplicationError: If task not found (non-retryable) or DB error
    """
    try:
        task_id = params["task_id"]
        new_status = params["status"]
        reason = params.get("reason")
        decided_by = params.get("decided_by", "unknown")
        metadata = params.get("metadata")

        # Validate status
        if new_status not in [ManTaskStatus.APPROVED.value, ManTaskStatus.DENIED.value]:
            raise ApplicationError(
                f"Invalid status: {new_status}. Must be APPROVED or DENIED.", non_retryable=True
            )

        # Build decision record
        decision = ManTaskDecision(
            status=ManTaskStatus(new_status),
            reason=reason,
            decided_by=decided_by,
            metadata=metadata,
        )

        # Get database provider
        db = get_database_provider()

        # Update task
        result = await db.update(
            table="man_tasks",
            updates={
                "status": new_status,
                "decision": decision.model_dump(),
                "decided_at": datetime.now(timezone.utc).isoformat(),
                "decided_by": decided_by,
            },
            filters={"id": task_id},
        )

        workflow_id = result.get("workflow_id", "")

        activity.logger.info(f"MAN task {task_id} resolved: {new_status} by {decided_by}")

        return {
            "success": True,
            "task_id": task_id,
            "status": new_status,
            "workflow_id": workflow_id,
        }

    except ApplicationError:
        raise
    except Exception as e:
        activity.logger.error(f"Failed to resolve MAN task: {str(e)}")

        # Check if it's a "not found" error
        if "not found" in str(e).lower():
            raise ApplicationError(
                f"MAN task {params.get('task_id')} not found", non_retryable=True
            ) from e

        raise ApplicationError(
            f"Database error in resolve_man_task: {str(e)}",
            non_retryable=False,  # Retryable for transient issues
        ) from e


# ============================================================================
# GET MAN TASK ACTIVITY
# ============================================================================


@activity.defn(name="get_man_task")
async def get_man_task(params: dict[str, Any]) -> dict[str, Any]:
    """
    Retrieve task status.

    Used for polling task status or getting decision details.

    Args:
        params: Dict with keys:
            - task_id: str (UUID) - lookup by ID
            OR
            - idempotency_key: str - lookup by key

    Returns:
        ManTask as dict, or None if not found

    Raises:
        ApplicationError: Database errors (retryable)
    """
    try:
        task_id = params.get("task_id")
        idempotency_key = params.get("idempotency_key")

        if not task_id and not idempotency_key:
            raise ApplicationError(
                "Must provide either task_id or idempotency_key", non_retryable=True
            )

        # Get database provider
        db = get_database_provider()

        # Build query filters
        filters = {}
        if task_id:
            filters["id"] = task_id
        else:
            filters["idempotency_key"] = idempotency_key

        # Query task
        results = await db.get(table="man_tasks", query_params=filters)

        if not results:
            return {"found": False, "task": None}

        task_data = results[0]

        activity.logger.debug(
            f"Retrieved MAN task: {task_data.get('id')} status={task_data.get('status')}"
        )

        return {
            "found": True,
            "task": task_data,
        }

    except ApplicationError:
        raise
    except Exception as e:
        activity.logger.error(f"Failed to get MAN task: {str(e)}")
        raise ApplicationError(
            f"Database error in get_man_task: {str(e)}", non_retryable=False
        ) from e


# ============================================================================
# HELPER: Check if decision received (for workflow polling)
# ============================================================================


@activity.defn(name="check_man_decision")
async def check_man_decision(params: dict[str, Any]) -> dict[str, Any]:
    """
    Check if a MAN task has been decided.

    Lightweight check for workflow polling. Returns decision status
    without full task details.

    Args:
        params: Dict with keys:
            - task_id: str (UUID)

    Returns:
        Dict with keys:
            - decided: bool
            - status: str|None (APPROVED/DENIED/EXPIRED if decided)
            - reason: str|None
    """
    try:
        result = await get_man_task(params)

        if not result.get("found"):
            return {
                "decided": False,
                "status": None,
                "reason": "Task not found",
            }

        task = result["task"]
        status = task.get("status")

        if status == ManTaskStatus.PENDING.value:
            return {
                "decided": False,
                "status": None,
                "reason": None,
            }

        # Extract reason from decision JSONB
        decision = task.get("decision", {})
        reason = decision.get("reason") if decision else None

        return {
            "decided": True,
            "status": status,
            "reason": reason,
        }

    except Exception as e:
        activity.logger.error(f"Failed to check MAN decision: {str(e)}")
        raise ApplicationError(f"Error checking MAN decision: {str(e)}", non_retryable=False) from e


# ============================================================================
# NOTIFY MAN TASK ACTIVITY (Standalone)
# ============================================================================


@activity.defn(name="notify_man_task")
async def notify_man_task(params: dict[str, Any]) -> dict[str, Any]:
    """
    Send push notifications for a MAN task.

    Standalone activity for manually triggering notifications.
    Useful for re-sending notifications or custom notification flows.

    Args:
        params: Dict with keys:
            - task_id: str (UUID)
            - workflow_id: str
            - step_id: str
            - intent: dict (ActionIntent)
            - triage_result: dict (RiskTriageResult)
            - expires_at: str (optional)

    Returns:
        Dict with keys:
            - success: bool
            - channels_attempted: int
            - channels_succeeded: int
            - errors: list[str]
    """
    try:
        task_id = params["task_id"]
        workflow_id = params["workflow_id"]
        step_id = params.get("step_id", "")
        intent_data = params["intent"]
        triage_data = params.get("triage_result", {})
        expires_at = params.get("expires_at")

        notification_service = get_notification_service()
        results = await notification_service.notify_task_created(
            task_id=task_id,
            workflow_id=workflow_id,
            step_id=step_id,
            intent=intent_data,
            triage_result=triage_data,
            expires_at=expires_at,
        )

        succeeded = sum(1 for r in results if r.success)
        errors = [f"{r.channel.value}: {r.error}" for r in results if not r.success and r.error]

        activity.logger.info(
            f"Notifications for MAN task {task_id}: {succeeded}/{len(results)} succeeded"
        )

        return {
            "success": succeeded > 0,
            "channels_attempted": len(results),
            "channels_succeeded": succeeded,
            "errors": errors,
        }

    except Exception as e:
        activity.logger.error(f"Failed to send MAN task notifications: {str(e)}")
        raise ApplicationError(
            f"Notification error: {str(e)}",
            non_retryable=False,  # Retryable for transient network issues
        ) from e
