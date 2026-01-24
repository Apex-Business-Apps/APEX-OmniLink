"""Policy evaluation activity for tool execution choke point."""

from typing import Any

from temporalio import activity

from security.omni_policy import evaluate_policy


@activity.defn(name="evaluate_policy")
async def evaluate_policy_activity(ctx: dict[str, Any]) -> dict[str, Any]:
    """
    Evaluate OmniPolicy for provided context.

    This is the single choke point before any tool execution.
    """
    return await evaluate_policy(ctx)

