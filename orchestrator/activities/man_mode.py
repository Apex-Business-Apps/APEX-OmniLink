"""
MAN Mode Temporal Activities.

Activities for human-in-the-loop safety in the APEX Orchestrator.
"""

import json
from typing import Any, Dict

from temporalio import activity
from temporalio.exceptions import ApplicationError

from ..models.man_mode import ActionIntent, ManTask, RiskTriageResult
from ..policies.man_policy import ManPolicy
from ..providers.database.factory import get_database_provider


@activity.defn(name="risk_triage")
async def risk_triage(intent: Dict[str, Any]) -> Dict[str, Any]:
    """
    Triage an action intent for risk assessment.

    Args:
        intent: ActionIntent as dict

    Returns:
        RiskTriageResult as dict
    """
    try:
        # Convert dict to ActionIntent
        action_intent = ActionIntent(**intent)

        # Create policy and triage
        policy = ManPolicy()
        result = policy.triage_intent(action_intent)

        return result.model_dump()

    except Exception as e:
        activity.logger.error(f"Risk triage failed: {str(e)}")
        raise ApplicationError(f"Risk triage failed: {str(e)}", non_retryable=False) from e


@activity.defn(name="create_man_task")
async def create_man_task(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a manual task for human review.

    Args:
        params: Parameters containing intent and triage result

    Returns:
        Created task data as dict
    """
    try:
        intent_data = params["intent"]
        triage_data = params["triage_result"]

        # Convert to models
        action_intent = ActionIntent(**intent_data)
        triage_result = RiskTriageResult(**triage_data)

        # Only create task if RED lane
        if triage_result.lane.value != "red":
            return {"created": False, "reason": "Not RED lane"}

        # Build idempotency key
        key_parts = [
            action_intent.workflow_id,
            action_intent.step_id or "",
            action_intent.tool_name,
            json.dumps(action_intent.tool_params, sort_keys=True),
        ]
        idempotency_key = "|".join(key_parts)

        # Create task data
        task_data = {
            "idempotency_key": idempotency_key,
            "status": "pending",
            "intent": intent_data,
            "decision": None,
            "created_at": "2026-01-07T00:00:00Z",  # Placeholder
            "updated_at": "2026-01-07T00:00:00Z",  # Placeholder
        }

        # Get database provider
        db = get_database_provider()

        # Upsert to database (breaks long line for 88-char limit)
        result = await db.upsert(
            table="man_tasks",
            record=task_data,
            conflict_columns=["idempotency_key"],
        )

        return {"created": True, "task": result}

    except Exception as e:
        activity.logger.error(f"Create MAN task failed: {str(e)}")
        raise ApplicationError(f"Create MAN task failed: {str(e)}", non_retryable=False) from e


@activity.defn(name="resolve_man_task")
async def resolve_man_task(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Resolve a manual task with a decision.

    Args:
        params: Parameters containing task_id and decision

    Returns:
        Updated task data as dict
    """
    try:
        task_id = params["task_id"]
        decision = params["decision"]

        # Get database provider
        db = get_database_provider()

        # Map decision to status
        decision_type = decision.get("decision")
        if decision_type == "APPROVE":
            status = "approved"
        elif decision_type == "DENY":
            status = "rejected"
        elif decision_type == "MODIFY":
            status = "modified"
        elif decision_type == "CANCEL_WORKFLOW":
            status = "cancelled"
        else:
            status = "approved"  # Default

        # Update task
        update_data = {
            "status": status,
            "decision": decision,
            "updated_at": "2026-01-07T00:00:00Z",  # Placeholder
        }

        result = await db.update(
            table="man_tasks",
            filters={"id": task_id},
            updates=update_data,
        )

        return {"resolved": True, "task": result}

    except Exception as e:
        activity.logger.error(f"Resolve MAN task failed: {str(e)}")
        raise ApplicationError(f"Resolve MAN task failed: {str(e)}", non_retryable=False) from e
