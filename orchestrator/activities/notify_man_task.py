"""
MAN Mode notification activity with idempotency.

Sends push notifications to operators when high-risk actions require approval.
"""

from datetime import UTC, datetime
from typing import Any

from temporalio import activity
from temporalio.exceptions import ApplicationError

from providers.database.factory import get_database_provider


@activity.defn(name="notify_man_task")
async def notify_man_task(params: dict[str, Any]) -> dict[str, Any]:
    """
    Send notification for MAN task (idempotent per channel).

    Creates idempotent notification records and optionally triggers
    push notifications via Supabase Realtime.

    Args:
        params: Dict with keys:
            - task_id: str (MAN task UUID)
            - workflow_id: str
            - step_id: str
            - channels: list[str] (e.g., ["email", "slack", "realtime"])
            - message: str (notification message)
            - metadata: dict (optional)

    Returns:
        Dict with keys:
            - notifications_created: int
            - notification_ids: list[str]
            - channels: list[str]

    Raises:
        ApplicationError: Database errors (retryable)
    """
    try:
        task_id = params["task_id"]
        workflow_id = params["workflow_id"]
        step_id = params.get("step_id", "")
        channels = params.get("channels", ["realtime"])
        message = params.get("message", "Action requires approval")
        metadata = params.get("metadata", {})

        db = get_database_provider()

        notification_ids = []

        for channel in channels:
            # Create idempotency key per channel
            idempotency_key = f"man_notify:{task_id}:{channel}"

            # Upsert notification (idempotent)
            notification = await db.upsert(
                table="man_notifications",
                record={
                    "idempotency_key": idempotency_key,
                    "task_id": task_id,
                    "workflow_id": workflow_id,
                    "step_id": step_id,
                    "channel": channel,
                    "message": message,
                    "metadata": metadata,
                    "sent_at": datetime.now(UTC).isoformat(),
                    "status": "sent",
                },
                conflict_columns=["idempotency_key"],
            )

            notification_ids.append(str(notification["id"]))
            activity.logger.info(f"✓ Notification sent via {channel} for MAN task {task_id}")

        # Notification is triggered via Postgres Changes on 'man_notifications' table.
        # The 'realtime' channel in params acts as a metadata tag for the UI.

        return {
            "notifications_created": len(notification_ids),
            "notification_ids": notification_ids,
            "channels": channels,
        }

    except ApplicationError:
        raise
    except Exception as e:
        activity.logger.error(f"Failed to send MAN notifications: {str(e)}")
        raise ApplicationError(
            f"Notification error: {str(e)}",
            non_retryable=False,  # Retryable for transient issues
        ) from e
