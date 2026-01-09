"""Unit tests for MAN Mode notification service."""

import os
from unittest.mock import patch

import pytest

from services.notifications import (
    NotificationChannel,
    NotificationPayload,
    NotificationResult,
    NotificationService,
    get_notification_service,
)


class TestNotificationChannel:
    """Test NotificationChannel enum."""

    def test_all_channels_present(self):
        """Should have all supported channels."""
        assert NotificationChannel.WEBHOOK == "webhook"
        assert NotificationChannel.SLACK == "slack"
        assert NotificationChannel.EMAIL == "email"
        assert NotificationChannel.CONSOLE == "console"

    def test_channel_serialization(self):
        """Channels should serialize to strings."""
        assert NotificationChannel.SLACK.value == "slack"
        assert str(NotificationChannel.WEBHOOK.value) == "webhook"


class TestNotificationPayload:
    """Test NotificationPayload model."""

    def test_create_valid_payload(self):
        """Should create valid notification payload."""
        payload = NotificationPayload(
            task_id="task-123",
            workflow_id="wf-456",
            step_id="step-1",
            tool_name="delete_record",
            lane="RED",
            reason="Sensitive tool requires approval",
            risk_factors=["irreversible", "data deletion"],
        )
        assert payload.task_id == "task-123"
        assert payload.tool_name == "delete_record"
        assert payload.lane == "RED"
        assert len(payload.risk_factors) == 2

    def test_minimal_payload(self):
        """Should create payload with only required fields."""
        payload = NotificationPayload(
            task_id="task-1",
            workflow_id="wf-1",
            step_id="s1",
            tool_name="test",
            lane="YELLOW",
            reason="test reason",
        )
        assert payload.risk_factors == []
        assert payload.params_summary is None
        assert payload.expires_at is None
        assert payload.dashboard_url is None

    def test_payload_has_created_at(self):
        """Payload should have auto-generated created_at."""
        payload = NotificationPayload(
            task_id="t",
            workflow_id="w",
            step_id="s",
            tool_name="t",
            lane="RED",
            reason="r",
        )
        assert payload.created_at is not None
        assert "T" in payload.created_at  # ISO format


class TestNotificationResult:
    """Test NotificationResult model."""

    def test_success_result(self):
        """Should create successful result."""
        result = NotificationResult(
            channel=NotificationChannel.SLACK,
            success=True,
            response_code=200,
        )
        assert result.success is True
        assert result.error is None

    def test_failure_result(self):
        """Should create failed result with error."""
        result = NotificationResult(
            channel=NotificationChannel.WEBHOOK,
            success=False,
            error="Connection refused",
            response_code=500,
        )
        assert result.success is False
        assert result.error == "Connection refused"


class TestNotificationService:
    """Test NotificationService class."""

    def test_init_default_channels(self):
        """Should default to console channel."""
        with patch.dict(os.environ, {}, clear=True):
            service = NotificationService()
            assert NotificationChannel.CONSOLE in service.enabled_channels

    def test_init_parse_multiple_channels(self):
        """Should parse comma-separated channels."""
        with patch.dict(os.environ, {"MAN_NOTIFICATION_CHANNELS": "slack,webhook,console"}):
            service = NotificationService()
            assert NotificationChannel.SLACK in service.enabled_channels
            assert NotificationChannel.WEBHOOK in service.enabled_channels
            assert NotificationChannel.CONSOLE in service.enabled_channels

    def test_init_skip_invalid_channels(self):
        """Should skip invalid channel names."""
        with patch.dict(os.environ, {"MAN_NOTIFICATION_CHANNELS": "slack,invalid,console"}):
            service = NotificationService()
            assert len(service.enabled_channels) == 2
            assert NotificationChannel.SLACK in service.enabled_channels
            assert NotificationChannel.CONSOLE in service.enabled_channels

    def test_build_dashboard_url(self):
        """Should build correct dashboard URL."""
        with patch.dict(os.environ, {"MAN_DASHBOARD_URL": "https://app.example.com/tasks"}):
            service = NotificationService()
            url = service._build_dashboard_url("task-abc-123")
            assert url == "https://app.example.com/tasks/task-abc-123"

    def test_format_risk_factors_empty(self):
        """Should handle empty risk factors."""
        service = NotificationService()
        result = service._format_risk_factors([])
        assert result == "  None identified"

    def test_format_risk_factors_multiple(self):
        """Should format multiple risk factors."""
        service = NotificationService()
        result = service._format_risk_factors(["high amount", "admin flag"])
        assert "  - high amount" in result
        assert "  - admin flag" in result

    def test_format_slack_message_structure(self):
        """Should format Slack Block Kit message."""
        service = NotificationService()
        payload = NotificationPayload(
            task_id="task-1",
            workflow_id="wf-1",
            step_id="step-1",
            tool_name="transfer_funds",
            lane="RED",
            reason="Sensitive financial operation",
            risk_factors=["amount > 10000"],
            dashboard_url="https://example.com/tasks/task-1",
        )
        message = service._format_slack_message(payload)

        assert "blocks" in message
        blocks = message["blocks"]
        assert len(blocks) >= 3  # header, section, action button

        # Check header has emoji
        header = blocks[0]
        assert header["type"] == "header"
        assert "Approval Required" in header["text"]["text"]

    def test_format_email_payload(self):
        """Should format email payload correctly."""
        service = NotificationService()
        payload = NotificationPayload(
            task_id="task-1",
            workflow_id="wf-1",
            step_id="step-1",
            tool_name="delete_user",
            lane="RED",
            reason="Destructive operation",
        )
        email = service._format_email_payload(payload)

        assert "subject" in email
        assert "body" in email
        assert "delete_user" in email["subject"]
        assert "RED" in email["subject"]
        assert email["priority"] == "high"

    def test_format_email_yellow_lane_normal_priority(self):
        """Yellow lane should have normal priority."""
        service = NotificationService()
        payload = NotificationPayload(
            task_id="t",
            workflow_id="w",
            step_id="s",
            tool_name="unknown_tool",
            lane="YELLOW",
            reason="Unknown tool",
        )
        email = service._format_email_payload(payload)
        assert email["priority"] == "normal"


class TestNotificationServiceAsync:
    """Async tests for NotificationService."""

    @pytest.mark.asyncio
    async def test_send_console_always_succeeds(self):
        """Console channel should always succeed."""
        service = NotificationService()
        payload = NotificationPayload(
            task_id="task-1",
            workflow_id="wf-1",
            step_id="step-1",
            tool_name="test_tool",
            lane="RED",
            reason="Test reason",
        )
        result = await service._send_console(payload)
        assert result.success is True
        assert result.channel == NotificationChannel.CONSOLE

    @pytest.mark.asyncio
    async def test_send_webhook_no_url_configured(self):
        """Should fail gracefully if webhook URL not configured."""
        with patch.dict(os.environ, {"MAN_NOTIFICATION_WEBHOOK_URL": ""}):
            service = NotificationService()
            service.webhook_url = None
            payload = NotificationPayload(
                task_id="t",
                workflow_id="w",
                step_id="s",
                tool_name="t",
                lane="RED",
                reason="r",
            )
            result = await service._send_webhook(payload)
            assert result.success is False
            assert "not configured" in result.error

    @pytest.mark.asyncio
    async def test_send_slack_no_url_configured(self):
        """Should fail gracefully if Slack URL not configured."""
        service = NotificationService()
        service.slack_webhook_url = None
        payload = NotificationPayload(
            task_id="t",
            workflow_id="w",
            step_id="s",
            tool_name="t",
            lane="RED",
            reason="r",
        )
        result = await service._send_slack(payload)
        assert result.success is False
        assert "not configured" in result.error

    @pytest.mark.asyncio
    async def test_send_email_no_endpoint_configured(self):
        """Should fail gracefully if email endpoint not configured."""
        service = NotificationService()
        service.email_endpoint = None
        payload = NotificationPayload(
            task_id="t",
            workflow_id="w",
            step_id="s",
            tool_name="t",
            lane="RED",
            reason="r",
        )
        result = await service._send_email(payload)
        assert result.success is False
        assert "not configured" in result.error

    @pytest.mark.asyncio
    async def test_notify_task_created_console_only(self):
        """Should send to console channel successfully."""
        with patch.dict(os.environ, {"MAN_NOTIFICATION_CHANNELS": "console"}):
            service = NotificationService()
            results = await service.notify_task_created(
                task_id="task-123",
                workflow_id="wf-456",
                step_id="step-1",
                intent={"tool_name": "delete_record", "params": {}},
                triage_result={"lane": "RED", "reason": "Sensitive tool"},
            )
            assert len(results) == 1
            assert results[0].success is True
            assert results[0].channel == NotificationChannel.CONSOLE

    @pytest.mark.asyncio
    async def test_notify_task_created_multiple_channels(self):
        """Should attempt all enabled channels."""
        with patch.dict(
            os.environ,
            {
                "MAN_NOTIFICATION_CHANNELS": "console,webhook",
                "MAN_NOTIFICATION_WEBHOOK_URL": "",
            },
        ):
            service = NotificationService()
            service.webhook_url = None  # Force no webhook
            results = await service.notify_task_created(
                task_id="task-123",
                workflow_id="wf-456",
                step_id="step-1",
                intent={"tool_name": "test", "params": {}},
                triage_result={"lane": "YELLOW", "reason": "Unknown"},
            )
            # Should have results for both channels
            assert len(results) == 2
            # Console should succeed, webhook should fail (not configured)
            console_result = next(r for r in results if r.channel == NotificationChannel.CONSOLE)
            webhook_result = next(r for r in results if r.channel == NotificationChannel.WEBHOOK)
            assert console_result.success is True
            assert webhook_result.success is False

    @pytest.mark.asyncio
    async def test_close_client(self):
        """Should close HTTP client cleanly."""
        service = NotificationService()
        # Create a client
        await service._get_client()
        assert service._client is not None
        # Close it
        await service.close()
        assert service._client is None


class TestGetNotificationService:
    """Test global notification service getter."""

    def test_get_notification_service_singleton(self):
        """Should return same instance."""
        # Clear any existing instance
        import services.notifications as notifications_module

        notifications_module._notification_service = None

        service1 = get_notification_service()
        service2 = get_notification_service()
        assert service1 is service2

    def test_get_notification_service_creates_instance(self):
        """Should create instance if none exists."""
        import services.notifications as notifications_module

        notifications_module._notification_service = None

        service = get_notification_service()
        assert service is not None
        assert isinstance(service, NotificationService)
