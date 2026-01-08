"""
MAN Mode Temporal Activities.

Activities for human-in-the-loop safety in the APEX Orchestrator.
"""

import json
from typing import Any

from temporalio import activity
from temporalio.exceptions import ApplicationError

from ..policies.man_policy import ManPolicy
from ..providers.database.factory import get_database_provider


@activity.defn(name="risk_triage")
async def risk_triage(intent: dict[str, Any]) -> dict[str, Any]:
    """
    Triage an action intent for risk assessment.

    Args:
        intent: ActionIntent as dict

    Returns:
        RiskTriageResult as dict
    """
    try:
        policy = ManPolicy()
        result = policy.triage_intent_payload(intent)
        return result
    except Exception as e:
        activity.logger.error(f"Risk triage failed: {str(e)}")
        raise ApplicationError(f"Risk triage failed: {str(e)}",
                               non_retryable=False) from e


@activity.defn(name="create_man_task")
async def create_man_task(params: dict[str, Any]) -> dict[str, Any]:
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

        # Build idempotency key
        key_parts = [
            intent_data["workflow_id"],
            intent_data.get("step_id", ""),
            intent_data["tool_name"],
            json.dumps(intent_data["params"], sort_keys=True),
        ]
        idempotency_key = "|".join(key_parts)

        # Create task data
        task_data = {
            "idempotency_key": idempotency_key,
            "status": "PENDING",
            "intent": intent_data,
            "decision": None,
        }

        # Get database provider
        db = get_database_provider()

        # Upsert to database
        result = await db.upsert(
            table="man_tasks",
            record=task_data,
            conflict_columns=["idempotency_key"],
        )

        return {"created": True, "task": result}

    except Exception as e:
        activity.logger.error(f"Create MAN task failed: {str(e)}")
        raise ApplicationError(f"MAN task operation failed: create failed",
                               non_retryable=False) from e


@activity.defn(name="resolve_man_task")
async def resolve_man_task(params: dict[str, Any]) -> dict[str, Any]:
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

        # Update task
        update_data = {
            "status": decision.get("decision", "APPROVED"),
            "decision": decision,
        }

        result = await db.update(
            table="man_tasks",
            filters={"id": task_id},
            updates=update_data,
        )

        return {"resolved": True, "task": result}

    except Exception as e:
        activity.logger.error(f"Resolve MAN task failed: {str(e)}")
        raise ApplicationError(f"MAN task operation failed: resolve failed",
                               non_retryable=False) from e
