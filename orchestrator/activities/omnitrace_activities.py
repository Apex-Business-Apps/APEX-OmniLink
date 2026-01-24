"""
OmniTrace Activities - Temporal Activities for Run Recording.

These activities handle the actual database writes for OmniTrace.
Called from workflows to record run lifecycle and events.
"""

from typing import Any

from temporalio import activity

from observability.omnitrace import (
    compute_hash,
    get_max_event_bytes,
    get_max_events_per_run,
    get_omnitrace_recorder,
    get_sample_rate,
    is_omnitrace_enabled,
    redact_dict,
    truncate_payload,
)


@activity.defn(name="omnitrace_record_run_start")
async def omnitrace_record_run_start(params: dict[str, Any]) -> dict[str, Any]:
    """
    Record workflow run start.

    Args:
        params: {
            "workflow_id": str,
            "trace_id": str,
            "user_id": str | None,
            "input_data": dict,
            "status": str (default: "running")
        }

    Returns:
        {"recorded": bool, "sampled": bool}
    """
    workflow_id = params.get("workflow_id", "")
    trace_id = params.get("trace_id", "")
    user_id = params.get("user_id")
    input_data = params.get("input_data", {})
    status = params.get("status", "running")

    recorder = get_omnitrace_recorder(workflow_id, trace_id)

    if not recorder.should_record():
        activity.logger.debug(f"OmniTrace: run not sampled (workflow={workflow_id})")
        return {"recorded": False, "sampled": False}

    await recorder.record_run_start(
        user_id=user_id,
        input_data=input_data,
        status=status,
    )

    activity.logger.info(f"OmniTrace: recorded run start (workflow={workflow_id})")
    return {"recorded": True, "sampled": True}


@activity.defn(name="omnitrace_record_run_complete")
async def omnitrace_record_run_complete(params: dict[str, Any]) -> dict[str, Any]:
    """
    Record workflow run completion.

    Args:
        params: {
            "workflow_id": str,
            "trace_id": str,
            "output_data": dict | None,
            "status": str (completed, failed, cancelled)
        }

    Returns:
        {"recorded": bool}
    """
    workflow_id = params.get("workflow_id", "")
    trace_id = params.get("trace_id", "")
    output_data = params.get("output_data")
    status = params.get("status", "completed")

    recorder = get_omnitrace_recorder(workflow_id, trace_id)

    if not recorder.should_record():
        return {"recorded": False}

    await recorder.record_run_complete(
        output_data=output_data,
        status=status,
    )

    activity.logger.info(
        f"OmniTrace: recorded run complete (workflow={workflow_id}, status={status})"
    )
    return {"recorded": True}


@activity.defn(name="omnitrace_record_event")
async def omnitrace_record_event(params: dict[str, Any]) -> dict[str, Any]:
    """
    Record a workflow event.

    Args:
        params: {
            "workflow_id": str,
            "trace_id": str,
            "event_key": str,
            "kind": str (tool, model, policy, cache, system),
            "name": str,
            "latency_ms": int | None,
            "data": dict | None
        }

    Returns:
        {"recorded": bool}
    """
    workflow_id = params.get("workflow_id", "")
    trace_id = params.get("trace_id", "")
    event_key = params.get("event_key", "")
    kind = params.get("kind", "system")
    name = params.get("name", "unknown")
    latency_ms = params.get("latency_ms")
    data = params.get("data")

    recorder = get_omnitrace_recorder(workflow_id, trace_id)

    if not recorder.should_record():
        return {"recorded": False}

    await recorder.record_event(
        event_key=event_key,
        kind=kind,
        name=name,
        latency_ms=latency_ms,
        data=data,
    )

    return {"recorded": True}


# =============================================================================
# ACTIVITY REGISTRATION HELPER
# =============================================================================


def get_omnitrace_activities() -> list:
    """Return list of OmniTrace activities for worker registration."""
    return [
        omnitrace_record_run_start,
        omnitrace_record_run_complete,
        omnitrace_record_event,
    ]
