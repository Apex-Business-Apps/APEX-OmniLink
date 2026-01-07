"""
Supabase Database Provider Implementation.

Implements the DatabaseProvider interface using Supabase Python client.
This maintains the current behavior while enabling future portability.
"""

from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from .base import DatabaseError, DatabaseProvider, NotFoundError


class SupabaseDatabaseProvider(DatabaseProvider):
    """
    Supabase implementation of the DatabaseProvider interface.

    Maintains compatibility with existing Supabase query patterns and error handling.
    """

    def __init__(self, url: str, key: str):
        """
        Initialize Supabase client.

        Args:
            url: Supabase project URL
            key: Supabase service role key
        """
        self.client: Client = create_client(url, key)

    async def select(
        self,
        table: str,
        filters: Optional[Dict[str, Any]] = None,
        select_fields: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Select records from Supabase table with optional filtering.

        Matches the behavior of the original tools.py implementation.
        """
        try:
            # Start query builder
            query = self.client.table(table)

            # Apply field selection
            if select_fields:
                query = query.select(select_fields)
            else:
                query = query.select("*")

            # Apply filters
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)

            # Execute query
            response = query.execute()

            # Return data (maintains existing behavior)
            return response.data if response.data else []

        except Exception as e:
            # Convert Supabase exceptions to our interface exceptions
            if "not found" in str(e).lower() or "no rows" in str(e).lower():
                raise NotFoundError(f"No records found in {table} with filters {filters}") from e
            raise DatabaseError(f"Database select failed: {str(e)}") from e

    async def insert(self, table: str, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Insert a record into Supabase table.

        Matches the behavior of the original tools.py implementation.
        """
        try:
            response = self.client.table(table).insert(record).execute()

            # Return the created record (maintains existing behavior)
            if response.data and len(response.data) > 0:
                return response.data[0]
            else:
                raise DatabaseError(f"Insert failed: no data returned for {table}")

        except Exception as e:
            raise DatabaseError(f"Database insert failed: {str(e)}") from e

    async def upsert(
        self,
        table: str,
        record: Dict[str, Any],
        on_conflict: str = "id"
    ) -> Dict[str, Any]:
        """Supabase implementation of upsert."""
        try:
            # Explicit vertical formatting for chain
            response = (
                self.client.table(table)
                .upsert(record, on_conflict=on_conflict)
                .execute()
            )

            if response.data and len(response.data) > 0:
                return response.data[0]
            else:
                raise DatabaseError(
                    f"Upsert failed: no data returned for {table}"
                )
        except Exception as e:
            raise DatabaseError(f"Database upsert failed: {str(e)}") from e

    async def update(
        self,
        table: str,
        record: Dict[str, Any],
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Supabase implementation of update."""
        try:
            query = self.client.table(table).update(record)
            for key, value in filters.items():
                query = query.eq(key, value)

            response = query.execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            else:
                # We assume update implies existence; raise if missing
                raise NotFound(
                    f"No records found to update in {table} with filters {filters}"
                )
        except Exception as e:
            if isinstance(e, NotFound):
                raise
            raise DatabaseError(f"Database update failed: {str(e)}") from e

    async def delete(self, table: str, filters: Dict[str, Any]) -> int:
        """
        Delete records from Supabase table matching filters.

        Matches the behavior of the original tools.py implementation.
        """
        try:
            # Start delete query
            query = self.client.table(table).delete()

            # Apply filters
            for key, value in filters.items():
                query = query.eq(key, value)

            # Execute delete
            response = query.execute()

            # Return count of deleted records (maintains existing behavior)
            return len(response.data) if response.data else 0

        except Exception as e:
            raise DatabaseError(f"Database delete failed: {str(e)}") from e
