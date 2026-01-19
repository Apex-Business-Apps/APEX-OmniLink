"""
Tests for audit log persistence with fallback logging.

Ensures audit events are never silently lost.
"""

import pytest
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from io import StringIO

from models.audit import (
    AuditAction,
    AuditLogEntry,
    AuditLogger,
    AuditResourceType,
    AuditStatus,
)


class TestAuditPersistence:
    """Test audit log persistence with fallback."""

    @pytest.fixture
    def audit_logger(self):
        """Create audit logger instance."""
        return AuditLogger(storage_backend="supabase")

    @pytest.fixture
    def sample_event(self):
        """Create sample audit event."""
        return AuditLogEntry(
            id="test-id-123",
            correlation_id="corr-123",
            timestamp=datetime.now(UTC),
            event_sequence=1,
            actor_id="user-123",
            action=AuditAction.DATA_ACCESS,
            status=AuditStatus.SUCCESS,
            resource_type=AuditResourceType.DATABASE,
            resource_id="profiles:123",
        )

    @pytest.mark.asyncio
    async def test_normal_insert_path_called(self, audit_logger, sample_event):
        """Normal insert path should use database provider."""
        mock_db = AsyncMock()
        mock_db.insert = AsyncMock(return_value={"id": "test-id-123"})

        with patch("models.audit.get_database_provider", return_value=mock_db):
            await audit_logger._store_supabase(sample_event)

            # Verify database insert was called
            mock_db.insert.assert_called_once()
            call_args = mock_db.insert.call_args
            assert call_args[1]["table"] == "audit_logs"
            assert "id" in call_args[1]["record"]

    @pytest.mark.asyncio
    async def test_fallback_triggered_on_db_failure(self, audit_logger, sample_event):
        """Fallback logging should trigger when DB fails."""
        mock_db = AsyncMock()
        mock_db.insert = AsyncMock(side_effect=Exception("DB connection failed"))

        # Capture stderr output
        captured_stderr = StringIO()

        with (
            patch("models.audit.get_database_provider", return_value=mock_db),
            patch("sys.stderr", captured_stderr),
        ):
            # Should not raise - fallback should handle failure
            await audit_logger._store_supabase(sample_event)

            # Check that fallback logging was triggered
            stderr_output = captured_stderr.getvalue()
            assert "CRITICAL: Audit persistence failed" in stderr_output
            assert "AUDIT_FALLBACK" in stderr_output
            assert sample_event.id in stderr_output
            assert "DATA_ACCESS" in stderr_output

    @pytest.mark.asyncio
    async def test_fallback_does_not_log_secrets(self, audit_logger, sample_event):
        """Fallback should not log sensitive data."""
        # Add some metadata that might contain secrets
        # SonarQube: These are TEST credentials used to verify they are NOT logged
        # This is intentional - we're testing the security feature that prevents logging secrets
        sample_event.metadata.custom_fields = {
            "api_key": "secret-key-123",
            "password": "hunter2",  # nosec - test data only
        }

        mock_db = AsyncMock()
        mock_db.insert = AsyncMock(side_effect=Exception("DB error"))

        import sys
        from io import StringIO

        captured_stderr = StringIO()

        with (
            patch("models.audit.get_database_provider", return_value=mock_db),
            patch("sys.stderr", captured_stderr),
        ):
            await audit_logger._store_supabase(sample_event)

            stderr_output = captured_stderr.getvalue()

            # Fallback should NOT contain secret values
            assert "secret-key-123" not in stderr_output
            assert "hunter2" not in stderr_output

            # Should only contain essential audit fields
            assert sample_event.id in stderr_output
            assert sample_event.actor_id in stderr_output

    @pytest.mark.asyncio
    async def test_fallback_includes_essential_fields(self, audit_logger, sample_event):
        """Fallback must include all essential audit fields."""
        mock_db = AsyncMock()
        mock_db.insert = AsyncMock(side_effect=Exception("DB error"))

        import sys
        from io import StringIO

        captured_stderr = StringIO()

        with (
            patch("models.audit.get_database_provider", return_value=mock_db),
            patch("sys.stderr", captured_stderr),
        ):
            await audit_logger._store_supabase(sample_event)

            stderr_output = captured_stderr.getvalue()

            # Check all essential fields are logged
            assert f"id={sample_event.id}" in stderr_output
            assert f"action={sample_event.action.value}" in stderr_output
            assert f"resource_type={sample_event.resource_type.value}" in stderr_output
            assert f"resource_id={sample_event.resource_id}" in stderr_output
            assert f"actor_id={sample_event.actor_id}" in stderr_output
            assert f"status={sample_event.status.value}" in stderr_output
            assert "timestamp=" in stderr_output


class TestAuditLoggerIntegration:
    """Integration tests for full audit logger."""

    @pytest.mark.asyncio
    async def test_log_event_end_to_end_success(self):
        """Test complete log_event flow with successful persistence."""
        logger = AuditLogger(storage_backend="supabase")

        event = AuditLogEntry(
            id="int-test-123",
            correlation_id="corr-456",
            timestamp=datetime.now(UTC),
            event_sequence=1,
            actor_id="user-789",
            action=AuditAction.LOGIN,
            status=AuditStatus.SUCCESS,
            resource_type=AuditResourceType.USER,
            resource_id="user-789",
        )

        mock_db = AsyncMock()
        mock_db.insert = AsyncMock(return_value={"id": event.id})

        with patch("models.audit.get_database_provider", return_value=mock_db):
            result_id = await logger.log_event(event)

            assert result_id == event.id
            assert event.processed_at is not None
            assert event.integrity_hash is not None
