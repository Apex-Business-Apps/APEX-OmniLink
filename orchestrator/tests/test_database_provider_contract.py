"""
Contract tests for DatabaseProvider interface compliance.

Ensures all provider implementations strictly follow the DatabaseProvider protocol.
"""

import pytest
from unittest.mock import MagicMock, patch

from providers.database.base import DatabaseError
from providers.database.supabase_provider import SupabaseDatabaseProvider


class TestDatabaseProviderContract:
    """Test DatabaseProvider interface compliance."""

    @pytest.fixture
    def mock_supabase_client(self):
        """Create mock Supabase client."""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        return mock_client, mock_table

    @pytest.fixture
    def provider(self, mock_supabase_client):
        """Create provider instance with mocked client."""
        with patch("providers.database.supabase_provider.create_client"):
            provider = SupabaseDatabaseProvider(url="http://test", key="test-key")
            provider.client = mock_supabase_client[0]
            return provider

    @pytest.mark.asyncio
    async def test_delete_returns_int(self, provider, mock_supabase_client):
        """delete() must return int (count of deleted rows), not bool."""
        _, mock_table = mock_supabase_client

        # Mock successful deletion of 2 rows
        mock_response = MagicMock()
        mock_response.data = [{"id": 1}, {"id": 2}]
        mock_table.delete.return_value.eq.return_value.execute.return_value = mock_response

        result = await provider.delete("audit_logs", {"workflow_id": "test"})

        assert isinstance(result, int), "delete() must return int"
        assert result == 2, "delete() should return count of deleted rows"

    @pytest.mark.asyncio
    async def test_delete_returns_zero_when_no_rows_deleted(self, provider, mock_supabase_client):
        """delete() must return 0 when no rows match."""
        _, mock_table = mock_supabase_client

        # Mock no rows deleted
        mock_response = MagicMock()
        mock_response.data = []
        mock_table.delete.return_value.eq.return_value.execute.return_value = mock_response

        result = await provider.delete("audit_logs", {"id": "nonexistent"})

        assert result == 0, "delete() should return 0 when no rows deleted"

    @pytest.mark.asyncio
    async def test_select_method_exists(self, provider):
        """select() method must exist and match protocol signature."""
        assert hasattr(provider, "select"), "Provider must have select() method"

        # Check method signature
        import inspect

        sig = inspect.signature(provider.select)
        params = list(sig.parameters.keys())

        assert "table" in params, "select() must have 'table' parameter"
        assert "filters" in params, "select() must have 'filters' parameter"
        assert "select_fields" in params, "select() must have 'select_fields' parameter"

    @pytest.mark.asyncio
    async def test_select_returns_list(self, provider, mock_supabase_client):
        """select() must return list of dicts."""
        _, mock_table = mock_supabase_client

        mock_response = MagicMock()
        mock_response.data = [{"id": 1, "name": "test"}]
        mock_table.select.return_value.eq.return_value.execute.return_value = mock_response

        result = await provider.select("audit_logs", filters={"id": 1})

        assert isinstance(result, list), "select() must return list"
        assert len(result) == 1
        assert result[0]["name"] == "test"

    @pytest.mark.asyncio
    async def test_disallowed_table_raises_database_error(self, provider):
        """Accessing disallowed table must raise DatabaseError."""
        with pytest.raises(DatabaseError) as exc_info:
            await provider.select("forbidden_table", filters={})

        assert "not in the allowed list" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_insert_validates_table_allowlist(self, provider):
        """insert() must validate table against allowlist."""
        with pytest.raises(DatabaseError) as exc_info:
            await provider.insert("forbidden_table", {"data": "test"})

        assert "not in the allowed list" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_man_tasks_table_allowed(self, provider, mock_supabase_client):
        """man_tasks table must be in allowlist."""
        _, mock_table = mock_supabase_client

        mock_response = MagicMock()
        mock_response.data = [{"id": 1}]
        mock_table.select.return_value.execute.return_value = mock_response

        # Should not raise DatabaseError
        result = await provider.select("man_tasks")
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_man_notifications_table_allowed(self, provider, mock_supabase_client):
        """man_notifications table must be in allowlist."""
        _, mock_table = mock_supabase_client

        mock_response = MagicMock()
        mock_response.data = []
        mock_table.select.return_value.execute.return_value = mock_response

        # Should not raise DatabaseError
        result = await provider.select("man_notifications")
        assert isinstance(result, list)


class TestBackwardsCompatibility:
    """Test backwards compatibility alias."""

    def test_supabase_provider_alias_exists(self):
        """SupabaseProvider alias must exist for backwards compatibility."""
        from providers.database.supabase_provider import SupabaseProvider

        assert SupabaseProvider is SupabaseDatabaseProvider, (
            "SupabaseProvider should be an alias for SupabaseDatabaseProvider"
        )
