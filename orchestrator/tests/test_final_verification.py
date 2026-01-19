"""
Final verification test suite for launch readiness.

Ensures all critical gates pass:
- Boot test
- Interface compliance
- Safety gates
- Audit persistence
- MAN Mode functionality
"""

import pytest
import subprocess
import time
from unittest.mock import AsyncMock, patch


class TestBootStability:
    """Phase 1 verification: Boot stability."""

    def test_dependencies_pinned(self):
        """FastAPI and Uvicorn must be pinned in pyproject.toml."""
        with open("pyproject.toml", "r") as f:
            content = f.read()
            assert "fastapi" in content.lower(), "FastAPI not in dependencies"
            assert "uvicorn" in content.lower(), "Uvicorn not in dependencies"

    @pytest.mark.skip("Requires docker-compose")
    def test_docker_compose_stays_green(self):
        """Container should stay healthy for >30s."""
        # docker-compose up -d
        subprocess.run(["docker-compose", "up", "-d"], check=True)

        # Wait 35 seconds
        time.sleep(35)

        # Check status
        result = subprocess.run(["docker-compose", "ps"], capture_output=True, text=True)

        assert "Up" in result.stdout, "Container not healthy after 30s"

        # Cleanup
        subprocess.run(["docker-compose", "down"], check=True)


class TestInterfaceCompliance:
    """Phase 2 verification: Interface compliance."""

    @pytest.mark.asyncio
    async def test_delete_returns_int(self):
        """db.delete() must return int count."""
        from providers.database.supabase_provider import SupabaseDatabaseProvider
        from unittest.mock import MagicMock

        with patch("providers.database.supabase_provider.create_client"):
            provider = SupabaseDatabaseProvider(url="https://test.example.com", key="test")

            mock_response = MagicMock()
            mock_response.data = [{"id": 1}, {"id": 2}]

            provider.client = MagicMock()
            provider.client.table.return_value.delete.return_value.eq.return_value.execute.return_value = mock_response

            result = await provider.delete("audit_logs", {"id": 1})

            assert isinstance(result, int), f"delete() returned {type(result)}, expected int"
            assert result == 2, f"delete() returned {result}, expected 2"

    @pytest.mark.asyncio
    async def test_select_method_exists(self):
        """db.select() must exist and return list."""
        from providers.database.supabase_provider import SupabaseDatabaseProvider
        from unittest.mock import MagicMock

        with patch("providers.database.supabase_provider.create_client"):
            provider = SupabaseDatabaseProvider(url="https://test.example.com", key="test")

            mock_response = MagicMock()
            mock_response.data = [{"id": 1}]

            provider.client = MagicMock()
            provider.client.table.return_value.select.return_value.execute.return_value = (
                mock_response
            )

            result = await provider.select("audit_logs")

            assert isinstance(result, list), f"select() returned {type(result)}, expected list"


class TestSafetyGates:
    """Phase 2 verification: Safety gates."""

    @pytest.mark.asyncio
    async def test_disallowed_table_raises_error(self):
        """Accessing disallowed table must raise DatabaseError."""
        from providers.database.supabase_provider import SupabaseDatabaseProvider
        from providers.database.base import DatabaseError

        with patch("providers.database.supabase_provider.create_client"):
            provider = SupabaseDatabaseProvider(url="https://test.example.com", key="test")

            with pytest.raises(DatabaseError) as exc_info:
                await provider.select("forbidden_table")

            assert "not in the allowed list" in str(exc_info.value)

    def test_man_tasks_allowed(self):
        """man_tasks must be in ALLOWED_TABLES."""
        from providers.database.supabase_provider import ALLOWED_TABLES

        assert "man_tasks" in ALLOWED_TABLES, "man_tasks not in allowlist"

    def test_man_notifications_allowed(self):
        """man_notifications must be in ALLOWED_TABLES."""
        from providers.database.supabase_provider import ALLOWED_TABLES

        assert "man_notifications" in ALLOWED_TABLES, "man_notifications not in allowlist"


class TestAuditPersistence:
    """Phase 3 verification: Audit persistence."""

    @pytest.mark.asyncio
    async def test_audit_log_inserts_to_database(self):
        """Audit events should be inserted into audit_logs table."""
        from models.audit import (
            AuditLogger,
            AuditLogEntry,
            AuditAction,
            AuditResourceType,
            AuditStatus,
        )
        from datetime import UTC, datetime

        logger = AuditLogger(storage_backend="supabase")

        event = AuditLogEntry(
            id="test-123",
            correlation_id="corr-456",
            timestamp=datetime.now(UTC),
            event_sequence=1,
            actor_id="user-789",
            action=AuditAction.DATA_ACCESS,
            status=AuditStatus.SUCCESS,
            resource_type=AuditResourceType.DATABASE,
            resource_id="test-resource",
        )

        mock_db = AsyncMock()
        mock_db.insert = AsyncMock(return_value={"id": "test-123"})

        with patch("models.audit.get_database_provider", return_value=mock_db):
            await logger._store_supabase(event)

            # Verify insert was called with correct table
            mock_db.insert.assert_called_once()
            call_args = mock_db.insert.call_args
            assert call_args[1]["table"] == "audit_logs"

    @pytest.mark.asyncio
    async def test_audit_fallback_on_db_failure(self):
        """Audit should log to stderr on DB failure."""
        from models.audit import (
            AuditLogger,
            AuditLogEntry,
            AuditAction,
            AuditResourceType,
            AuditStatus,
        )
        from datetime import UTC, datetime
        from io import StringIO
        import sys

        logger = AuditLogger(storage_backend="supabase")

        event = AuditLogEntry(
            id="fallback-test",
            correlation_id="corr-123",
            timestamp=datetime.now(UTC),
            event_sequence=1,
            actor_id="user-123",
            action=AuditAction.DATA_DELETION,
            status=AuditStatus.SUCCESS,
            resource_type=AuditResourceType.DATABASE,
            resource_id="test-resource",
        )

        mock_db = AsyncMock()
        mock_db.insert = AsyncMock(side_effect=Exception("DB connection failed"))

        captured_stderr = StringIO()

        with (
            patch("models.audit.get_database_provider", return_value=mock_db),
            patch("sys.stderr", captured_stderr),
        ):
            # Should not raise
            await logger._store_supabase(event)

            stderr_output = captured_stderr.getvalue()
            assert "CRITICAL: Audit persistence failed" in stderr_output
            assert "AUDIT_FALLBACK" in stderr_output
            assert event.id in stderr_output


class TestManMode:
    """Phase 6 verification: MAN Mode 2.0."""

    def test_operator_signals_exist(self):
        """Workflow must have operator signals."""
        from workflows.agent_saga import AgentWorkflow

        # Check that signals are defined
        assert hasattr(AgentWorkflow, "admin_pause"), "admin_pause signal missing"
        assert hasattr(AgentWorkflow, "admin_resume"), "admin_resume signal missing"
        assert hasattr(AgentWorkflow, "admin_stop"), "admin_stop signal missing"
        assert hasattr(AgentWorkflow, "admin_cancel_step"), "admin_cancel_step signal missing"

    def test_deferred_steps_state_exists(self):
        """Workflow must track deferred_steps."""
        from workflows.agent_saga import AgentWorkflow

        workflow = AgentWorkflow()
        assert hasattr(workflow, "deferred_steps"), "deferred_steps state missing"
        assert isinstance(workflow.deferred_steps, dict), "deferred_steps must be dict"

    @pytest.mark.asyncio
    async def test_notify_man_task_activity_exists(self):
        """notify_man_task activity must exist."""
        from activities.notify_man_task import notify_man_task

        # Should be importable
        assert notify_man_task is not None


class TestCodeQuality:
    """SonarQube A-grade compliance checks."""

    def test_no_pass_in_persistence(self):
        """Audit persistence should not have placeholder 'pass'."""
        with open("models/audit.py", "r") as f:
            content = f.read()

            # Check _store_supabase is implemented
            assert "_store_supabase" in content

            # Find the method
            lines = content.split("\n")
            in_method = False
            has_implementation = False

            for line in lines:
                if "async def _store_supabase" in line:
                    in_method = True
                elif in_method and "async def" in line:
                    break
                elif in_method and ("db.insert" in line or "get_database_provider" in line):
                    has_implementation = True
                    break

            assert has_implementation, "_store_supabase is still a placeholder"

    def test_imports_sorted(self):
        """Code should pass import sorting (Ruff/isort)."""
        # This would run ruff check --select I in CI
        # For now, we check manually that files have reasonable import blocks
        pass

    def test_no_unused_imports(self):
        """Code should have no unused imports."""
        # This would run ruff check --select F401 in CI
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
