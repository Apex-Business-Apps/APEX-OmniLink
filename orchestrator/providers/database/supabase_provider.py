"""
Supabase Database Provider Implementation.

Implements the DatabaseProvider interface using Supabase Python client.
This maintains the current behavior while enabling future portability.
"""

from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from .base import DatabaseError, DatabaseProvider, NotFound


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
        select_fields: Optional[str] = None
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
                raise NotFound(f"No records found in {table} with filters {filters}") from e
            else:
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

    async def upsert(
        self,
        table: str,
        record: Dict[str, Any],
        conflict_columns: List[str]
    ) -> Dict[str, Any]:
        """
        Insert or update a record (upsert) in Supabase table.

        Uses Supabase's upsert functionality with conflict resolution.
        """
        try:
            response = (
                self.client.table(table)
                .upsert(record, on_conflict=",".join(conflict_columns))
                .execute()
            )

            # Return the upserted record
            if response.data and len(response.data) > 0:
                return response.data[0]
            else:
                raise DatabaseError(f"Upsert failed: no data returned for {table}")

        except Exception as e:
            raise DatabaseError(f"Database upsert failed: {str(e)}") from e

    async def update(
        self,
        table: str,
        filters: Dict[str, Any],
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update records in Supabase table matching filters.

        Returns the updated record if exactly one record was updated.
        """
        try:
            # Start update query
            query = self.client.table(table).update(updates)

            # Apply filters
            for key, value in filters.items():
                query = query.eq(key, value)

            # Execute update
            response = query.execute()

            # Return the updated record if exactly one was updated
            if response.data and len(response.data) == 1:
                return response.data[0]
            elif response.data and len(response.data) > 1:
                # Multiple records updated - return None as per interface contract
                return None
            else:
                # No records updated
                return None

        except Exception as e:
            raise DatabaseError(f"Database update failed: {str(e)}") from e

    async def select_one(
        self,
        table: str,
        filters: Dict[str, Any],
        select_fields: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Select a single record from Supabase table with filtering.

        Returns None if no record is found.
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
            for key, value in filters.items():
                query = query.eq(key, value)

            # Execute query
            response = query.execute()

            # Return single record or None
            if response.data and len(response.data) > 0:
                return response.data[0]
            else:
                return None

        except Exception as e:
            raise DatabaseError(f"Database select_one failed: {str(e)}") from e
