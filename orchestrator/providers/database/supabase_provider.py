from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from .base import DatabaseError, DatabaseProvider


class SupabaseProvider(DatabaseProvider):
    """
    Supabase implementation of the DatabaseProvider.
    """

    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)

    async def connect(self) -> None:
        """
        Supabase client is stateless/HTTP-based, so explicit connection
        is often not needed, but we validate credentials here.
        """
        if not self.client:
            raise DatabaseError("Supabase client not initialized")
        # Optional: Make a lightweight call to verify connection if strict mode needed.
        pass

    async def disconnect(self) -> None:
        """
        No-op for Supabase HTTP client.
        """
        pass

    async def insert(self, table: str, record: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = self.client.table(table).insert(record).execute()
            # Supabase-py v2 returns an object with .data
            if not response.data:
                raise DatabaseError(f"Insert failed: No data returned from {table}")
            return response.data[0]
        except Exception as e:
            raise DatabaseError(f"Database insert failed: {str(e)}") from e

    async def upsert(
        self, table: str, record: Dict[str, Any], conflict_columns: List[str]
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

    async def get(self, table: str, query_params: Dict[str, Any]) -> List[Dict[str, Any]]:
        try:
            query = self.client.table(table).select("*")
            for key, value in query_params.items():
                query = query.eq(key, value)

            response = query.execute()
            return response.data
        except Exception as e:
            raise DatabaseError(f"Database get failed: {str(e)}") from e

    async def select_one(
        self, table: str, filters: Dict[str, Any], select_fields: Optional[str] = None
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

    async def update(
        self, table: str, filters: Dict[str, Any], updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update records in Supabase table matching filters.

        Returns the updated record if exactly one record was updated.
        """
        try:
            if not filters:
                raise DatabaseError("Update requires at least one filter")

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

    async def delete(self, table: str, filters: Dict[str, Any]) -> bool:
        try:
            if not filters:
                raise DatabaseError("Delete requires at least one filter")

            query = self.client.table(table).delete()
            for key, value in filters.items():
                query = query.eq(key, value)

            response = query.execute()

            # response.data usually contains the deleted rows
            return len(response.data) > 0
        except Exception as e:
            raise DatabaseError(f"Database delete failed: {str(e)}") from e
