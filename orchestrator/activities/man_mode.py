from typing import Any, Dict

from temporalio import activity

from config import settings
from policies.man_policy import ManPolicy
from providers.database.factory import get_database_provider

# Initialize DB provider outside the activity loop for connection pooling
db = get_database_provider(
    settings.database_provider,
    settings.supabase_url,
    settings.supabase_service_role_key,
)


@activity.defn
async def risk_triage(tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate risk for a proposed activity."""
    try:
        triage_result = ManPolicy.triage(tool_name, tool_input)
        return triage_result.model_dump(mode="json")
    except Exception as e:
        activity.logger.error(f"Risk triage failed: {e}")
        raise


@activity.defn
async def create_man_task(
    workflow_id: str,
    run_id: str,
    step_id: str,
    tool_name: str,
    tool_input: Dict[str, Any],
    triage_result: Dict[str, Any],
    tenant_id: str = "default",
) -> Dict[str, Any]:
    """Create a PENDING task in the database for human review."""
    # Deterministic key ensures we don't duplicate tasks on replay
    idempotency_key = f"{workflow_id}-{step_id}-{tool_name}"

    task_data = {
        "idempotency_key": idempotency_key,
        "tenant_id": tenant_id,
        "workflow_id": workflow_id,
        "run_id": run_id,
        "step_id": step_id,
        "tool_name": tool_name,
        "tool_input": tool_input,
        "triage_result": triage_result,
        "status": "PENDING",
    }

    try:
        record = await db.upsert(
            table="man_tasks",
            record=task_data,
            on_conflict="idempotency_key,tenant_id",
        )
        return record
    except Exception as e:
        activity.logger.error(f"Failed to create MAN task: {e}")
        raise


@activity.defn
async def resolve_man_task(task_id: str, decision: Dict[str, Any]) -> Dict[str, Any]:
    """Update the task status in DB with the human decision."""
    try:
        update_data = {"status": decision["status"], "decision": decision}

        record = await db.update(
            table="man_tasks",
            record=update_data,
            filters={"id": task_id},
        )
        return record
    except Exception as e:
        activity.logger.error(f"Failed to resolve MAN task: {e}")
        raise
