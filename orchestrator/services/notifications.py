"""
MAN Mode Notification Service.

Sends push notifications when MAN tasks are created, requiring human approval.
Supports multiple channels: webhook, Slack, email.

Design Principles:
- Fire-and-forget: Notification failures don't block task creation
- Configurable: Channel settings via environment variables
- Extensible: Easy to add new notification channels
"""

import asyncio
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

import httpx
from pydantic import BaseModel, Field


class NotificationChannel(str, Enum):
    """Supported notification channels."""

    WEBHOOK = "webhook"
    SLACK = "slack"
    EMAIL = "email"
    CONSOLE = "console"  # For development/testing


class NotificationPayload(BaseModel):
    """Payload for MAN task notifications."""

    task_id: str
    workflow_id: str
    step_id: str
    tool_name: str
    lane: str
    reason: str
    risk_factors: list[str] = Field(default_factory=list)
    params_summary: Optional[str] = None
    expires_at: Optional[str] = None
    dashboard_url: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class NotificationResult(BaseModel):
    """Result of notification attempt."""

    channel: NotificationChannel
    success: bool
    error: Optional[str] = None
    response_code: Optional[int] = None


class NotificationService:
    """
    Service for sending MAN Mode notifications.

    Usage:
        service = NotificationService()
        await service.notify_task_created(payload)
    """

    def __init__(self) -> None:
        """Initialize notification service with configured channels."""
        self.webhook_url = os.getenv("MAN_NOTIFICATION_WEBHOOK_URL")
        self.slack_webhook_url = os.getenv("MAN_SLACK_WEBHOOK_URL")
        self.email_endpoint = os.getenv("MAN_EMAIL_NOTIFICATION_ENDPOINT")
        self.dashboard_base_url = os.getenv("MAN_DASHBOARD_URL", "https://apex.app/man/tasks")
        self.enabled_channels = self._parse_enabled_channels()
        self._client: Optional[httpx.AsyncClient] = None

    def _parse_enabled_channels(self) -> list[NotificationChannel]:
        """Parse enabled channels from environment."""
        channels_str = os.getenv("MAN_NOTIFICATION_CHANNELS", "console")
        channels = []
        for ch in channels_str.split(","):
            ch = ch.strip().lower()
            try:
                channels.append(NotificationChannel(ch))
            except ValueError:
                pass  # Skip invalid channel names
        return channels if channels else [NotificationChannel.CONSOLE]

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_dashboard_url(self, task_id: str) -> str:
        """Build dashboard URL for task."""
        return f"{self.dashboard_base_url}/{task_id}"

    def _format_risk_factors(self, factors: list[str]) -> str:
        """Format risk factors for display."""
        if not factors:
            return "  None identified"
        return "\n".join(f"  - {f}" for f in factors)

    def _format_slack_message(self, payload: NotificationPayload) -> dict[str, Any]:
        """Format Slack Block Kit message."""
        risk_emoji = {"RED": ":red_circle:", "YELLOW": ":large_yellow_circle:"}.get(
            payload.lane, ":white_circle:"
        )

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{risk_emoji} MAN Mode: Approval Required",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Tool:*\n`{payload.tool_name}`"},
                    {"type": "mrkdwn", "text": f"*Lane:*\n{payload.lane}"},
                    {"type": "mrkdwn", "text": f"*Workflow:*\n`{payload.workflow_id}`"},
                    {"type": "mrkdwn", "text": f"*Step:*\n`{payload.step_id}`"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Reason:*\n{payload.reason}"},
            },
        ]

        if payload.risk_factors:
            factors_text = "\n".join(f"• {f}" for f in payload.risk_factors)
            blocks.append(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Risk Factors:*\n{factors_text}",
                    },
                }
            )

        if payload.dashboard_url:
            blocks.append(
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Review in Dashboard",
                                "emoji": True,
                            },
                            "url": payload.dashboard_url,
                            "style": "primary",
                        }
                    ],
                }
            )

        return {"blocks": blocks}

    def _format_email_payload(self, payload: NotificationPayload) -> dict[str, Any]:
        """Format email notification payload."""
        subject = f"[MAN Mode] Approval Required: {payload.tool_name} ({payload.lane})"

        body = f"""
A high-risk action requires your approval.

Tool: {payload.tool_name}
Risk Lane: {payload.lane}
Reason: {payload.reason}

Workflow ID: {payload.workflow_id}
Step ID: {payload.step_id}
Task ID: {payload.task_id}

Risk Factors:
{self._format_risk_factors(payload.risk_factors)}

Expires: {payload.expires_at or "Not set"}

Review this request: {payload.dashboard_url or "Dashboard URL not configured"}
"""

        return {
            "subject": subject,
            "body": body.strip(),
            "task_id": payload.task_id,
            "priority": "high" if payload.lane == "RED" else "normal",
        }

    async def _send_webhook(self, payload: NotificationPayload) -> NotificationResult:
        """Send notification via generic webhook."""
        if not self.webhook_url:
            return NotificationResult(
                channel=NotificationChannel.WEBHOOK,
                success=False,
                error="Webhook URL not configured",
            )

        try:
            client = await self._get_client()
            response = await client.post(
                self.webhook_url,
                json=payload.model_dump(),
                headers={"Content-Type": "application/json"},
            )
            return NotificationResult(
                channel=NotificationChannel.WEBHOOK,
                success=response.is_success,
                response_code=response.status_code,
                error=None if response.is_success else response.text[:200],
            )
        except Exception as e:
            return NotificationResult(
                channel=NotificationChannel.WEBHOOK,
                success=False,
                error=str(e)[:200],
            )

    async def _send_slack(self, payload: NotificationPayload) -> NotificationResult:
        """Send notification to Slack."""
        if not self.slack_webhook_url:
            return NotificationResult(
                channel=NotificationChannel.SLACK,
                success=False,
                error="Slack webhook URL not configured",
            )

        try:
            client = await self._get_client()
            slack_msg = self._format_slack_message(payload)
            response = await client.post(
                self.slack_webhook_url,
                json=slack_msg,
                headers={"Content-Type": "application/json"},
            )
            return NotificationResult(
                channel=NotificationChannel.SLACK,
                success=response.is_success,
                response_code=response.status_code,
                error=None if response.is_success else response.text[:200],
            )
        except Exception as e:
            return NotificationResult(
                channel=NotificationChannel.SLACK,
                success=False,
                error=str(e)[:200],
            )

    async def _send_email(self, payload: NotificationPayload) -> NotificationResult:
        """Send email notification via configured endpoint."""
        if not self.email_endpoint:
            return NotificationResult(
                channel=NotificationChannel.EMAIL,
                success=False,
                error="Email endpoint not configured",
            )

        try:
            client = await self._get_client()
            email_payload = self._format_email_payload(payload)
            response = await client.post(
                self.email_endpoint,
                json=email_payload,
                headers={"Content-Type": "application/json"},
            )
            return NotificationResult(
                channel=NotificationChannel.EMAIL,
                success=response.is_success,
                response_code=response.status_code,
                error=None if response.is_success else response.text[:200],
            )
        except Exception as e:
            return NotificationResult(
                channel=NotificationChannel.EMAIL,
                success=False,
                error=str(e)[:200],
            )

    async def _send_console(self, payload: NotificationPayload) -> NotificationResult:
        """Log notification to console (for development)."""
        print(f"\n{'=' * 60}")
        print("MAN MODE NOTIFICATION")
        print(f"{'=' * 60}")
        print(f"Task ID:     {payload.task_id}")
        print(f"Tool:        {payload.tool_name}")
        print(f"Lane:        {payload.lane}")
        print(f"Reason:      {payload.reason}")
        print(f"Workflow:    {payload.workflow_id}")
        print(f"Step:        {payload.step_id}")
        if payload.risk_factors:
            print(f"Risk Factors: {', '.join(payload.risk_factors)}")
        if payload.dashboard_url:
            print(f"Dashboard:   {payload.dashboard_url}")
        print(f"{'=' * 60}\n")

        return NotificationResult(
            channel=NotificationChannel.CONSOLE,
            success=True,
        )

    async def notify_task_created(
        self,
        task_id: str,
        workflow_id: str,
        step_id: str,
        intent: dict[str, Any],
        triage_result: dict[str, Any],
        expires_at: Optional[str] = None,
    ) -> list[NotificationResult]:
        """
        Send notifications for a newly created MAN task.

        Fire-and-forget: failures are logged but don't raise exceptions.

        Args:
            task_id: UUID of the created task
            workflow_id: Parent workflow ID
            step_id: Step within workflow
            intent: ActionIntent as dict
            triage_result: RiskTriageResult as dict
            expires_at: Optional expiration timestamp

        Returns:
            List of NotificationResult for each channel attempted
        """
        # Build payload
        payload = NotificationPayload(
            task_id=task_id,
            workflow_id=workflow_id,
            step_id=step_id,
            tool_name=intent.get("tool_name", "unknown"),
            lane=triage_result.get("lane", "UNKNOWN"),
            reason=triage_result.get("reason", "No reason provided"),
            risk_factors=triage_result.get("risk_factors", []),
            params_summary=str(intent.get("params", {}))[:500],
            expires_at=expires_at,
            dashboard_url=self._build_dashboard_url(task_id),
        )

        # Send to all enabled channels concurrently
        channel_handlers = {
            NotificationChannel.WEBHOOK: self._send_webhook,
            NotificationChannel.SLACK: self._send_slack,
            NotificationChannel.EMAIL: self._send_email,
            NotificationChannel.CONSOLE: self._send_console,
        }

        tasks = []
        for channel in self.enabled_channels:
            handler = channel_handlers.get(channel)
            if handler:
                tasks.append(handler(payload))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Convert exceptions to failed results
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                final_results.append(
                    NotificationResult(
                        channel=self.enabled_channels[i],
                        success=False,
                        error=str(result)[:200],
                    )
                )
            else:
                final_results.append(result)

        return final_results


# Global instance for easy access
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """Get or create global notification service instance."""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
