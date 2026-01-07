"""
Unit tests for database provider extensions (MAN Mode).

Tests the upsert, update, and select_one methods added for MAN Mode functionality.
"""

from unittest.mock import MagicMock

import pytest
from orchestrator.providers.database.base import DatabaseError
from orchestrator.providers.database.supabase_provider import SupabaseDatabaseProvider


class TestDatabaseProviderExtensions:
    """Test the extended database provider methods."""

    @pytest.fixture
    def mock_supabase_client(self):
        """Mock Supabase client for testing."""
        client = MagicMock()

        # Mock table method to return a query builder
        table_mock = MagicMock()
        client.table.return_value = table_mock

        # Mock the query builder methods
        table_mock.select.return_value = table_mock
        table_mock.upsert.return_value = table_mock
        table_mock.update.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.execute.return_value = MagicMock()

        return client

    @pytest.fixture
    def provider(self, mock_supabase_client):
        """Create provider with mocked client."""
        provider = SupabaseDatabaseProvider("http://test", "test-key")
        provider.client = mock_supabase_client
        return provider

    @pytest.mark.asyncio
    async def test_upsert_success(self, provider, mock_supabase_client):
        """Test successful upsert operation."""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.data = [{"id": "123", "name": "test"}]
        mock_supabase_client.table.return_value.upsert.return_value.execute.return_value = mock_response

        # Test upsert
        result = await provider.upsert(
            table="test_table",
            record={"id": "123", "name": "test"},
            conflict_columns=["id"]
        )

        # Verify result
        assert result == {"id": "123", "name": "test"}

        # Verify Supabase client was called correctly
        mock_supabase_client.table.assert_called_with("test_table")
        mock_supabase_client.table.return_value.upsert.assert_called_with(
            {"id": "123", "name": "test"},
            on_conflict="id"
        )

    @pytest.mark.asyncio
    async def test_upsert_failure_no_data(self, provider, mock_supabase_client):
        """Test upsert failure when no data is returned."""
        # Setup mock response with no data
        mock_response = MagicMock()
        mock_response.data = []
        mock_supabase_client.table.return_value.upsert.return_value.execute.return_value = mock_response

        # Test upsert and expect failure
        with pytest.raises(DatabaseError, match="Upsert failed"):
            await provider.upsert(
                table="test_table",
                record={"id": "123", "name": "test"},
                conflict_columns=["id"]
            )

    @pytest.mark.asyncio
    async def test_upsert_exception_handling(self, provider, mock_supabase_client):
        """Test upsert exception handling."""
        # Setup mock to raise exception
        mock_supabase_client.table.return_value.upsert.return_value.execute.side_effect = Exception("DB error")

        # Test upsert and expect DatabaseError
        with pytest.raises(DatabaseError, match="Database upsert failed"):
            await provider.upsert(
                table="test_table",
                record={"id": "123", "name": "test"},
                conflict_columns=["id"]
            )

    @pytest.mark.asyncio
    async def test_update_single_record(self, provider, mock_supabase_client):
        """Test successful update of single record."""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.data = [{"id": "123", "name": "updated"}]
        mock_supabase_client.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_response

        # Test update
        result = await provider.update(
            table="test_table",
            filters={"id": "123"},
            updates={"name": "updated"}
        )

        # Verify result
        assert result == {"id": "123", "name": "updated"}

    @pytest.mark.asyncio
    async def test_update_multiple_records(self, provider, mock_supabase_client):
        """Test update affecting multiple records returns None."""
        # Setup mock response with multiple records
        mock_response = MagicMock()
        mock_response.data = [{"id": "123"}, {"id": "456"}]
        mock_supabase_client.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_response

        # Test update
        result = await provider.update(
            table="test_table",
            filters={"status": "pending"},
            updates={"status": "processed"}
        )

        # Should return None for multiple updates
        assert result is None

    @pytest.mark.asyncio
    async def test_update_no_records(self, provider, mock_supabase_client):
        """Test update with no matching records."""
        # Setup mock response with no data
        mock_response = MagicMock()
        mock_response.data = []
        mock_supabase_client.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_response

        # Test update
        result = await provider.update(
            table="test_table",
            filters={"id": "nonexistent"},
            updates={"name": "updated"}
        )

        # Should return None
        assert result is None

    @pytest.mark.asyncio
    async def test_update_exception_handling(self, provider, mock_supabase_client):
        """Test update exception handling."""
        # Setup mock to raise exception
        mock_supabase_client.table.return_value.update.return_value.eq.return_value.execute.side_effect = Exception("DB error")

        # Test update and expect DatabaseError
        with pytest.raises(DatabaseError, match="Database update failed"):
            await provider.update(
                table="test_table",
                filters={"id": "123"},
                updates={"name": "updated"}
            )

    @pytest.mark.asyncio
    async def test_select_one_found(self, provider, mock_supabase_client):
        """Test select_one when record is found."""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.data = [{"id": "123", "name": "test"}]
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response

        # Test select_one
        result = await provider.select_one(
            table="test_table",
            filters={"id": "123"}
        )

        # Verify result
        assert result == {"id": "123", "name": "test"}

    @pytest.mark.asyncio
    async def test_select_one_not_found(self, provider, mock_supabase_client):
        """Test select_one when no record is found."""
        # Setup mock response with no data
        mock_response = MagicMock()
        mock_response.data = []
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response

        # Test select_one
        result = await provider.select_one(
            table="test_table",
            filters={"id": "nonexistent"}
        )

        # Should return None
        assert result is None

    @pytest.mark.asyncio
    async def test_select_one_with_fields(self, provider, mock_supabase_client):
        """Test select_one with specific field selection."""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.data = [{"id": "123", "name": "test"}]
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response

        # Test select_one with field selection
        result = await provider.select_one(
            table="test_table",
            filters={"id": "123"},
            select_fields="id,name"
        )

        # Verify result
        assert result == {"id": "123", "name": "test"}

        # Verify select was called with fields
        mock_supabase_client.table.return_value.select.assert_called_with("id,name")

    @pytest.mark.asyncio
    async def test_select_one_exception_handling(self, provider, mock_supabase_client):
        """Test select_one exception handling."""
        # Setup mock to raise exception
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("DB error")

        # Test select_one and expect DatabaseError
        with pytest.raises(DatabaseError, match="Database select_one failed"):
            await provider.select_one(
                table="test_table",
                filters={"id": "123"}
            )

    @pytest.mark.asyncio
    async def test_upsert_multiple_conflict_columns(self, provider, mock_supabase_client):
        """Test upsert with multiple conflict columns."""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.data = [{"id": "123", "tenant_id": "t1"}]
        mock_supabase_client.table.return_value.upsert.return_value.execute.return_value = mock_response

        # Test upsert with multiple conflict columns
        result = await provider.upsert(
            table="test_table",
            record={"id": "123", "tenant_id": "t1", "data": "test"},
            conflict_columns=["id", "tenant_id"]
        )

        # Verify result
        assert result == {"id": "123", "tenant_id": "t1"}

        # Verify upsert was called with joined conflict columns
        mock_supabase_client.table.return_value.upsert.assert_called_with(
            {"id": "123", "tenant_id": "t1", "data": "test"},
            on_conflict="id,tenant_id"
        )
