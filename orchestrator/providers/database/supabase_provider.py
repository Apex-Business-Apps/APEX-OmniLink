import os
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from .base import DatabaseError, DatabaseProvider, NotFound


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
        self,
        table: str,
        filters: Optional[Dict[str, Any]] = None,
        select_fields: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform an upsert (insert or update on conflict).
        """
        try:
            query = self.client.table(table).upsert(record)
            
            # If specific conflict columns are needed (depending on supabase-py version support)
            # strictly speaking, standard upsert relies on PK constraints.
            response = query.execute()

            if not response.data:
                raise DatabaseError(f"Upsert failed: No data returned from {table}")
            return response.data[0]
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

    async def select_one(self, table: str, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Retrieve a single record. Raises NotFound if not found.
        """
        results = await self.get(table, query_params)
        if not results:
            # Format params for cleaner error log
            params_str = ", ".join(f"{k}={v}" for k, v in query_params.items())
            raise NotFound(f"Record not found in {table} matching: {params_str}")
        return results[0]

    async def update(
        self, table: str, updates: Dict[str, Any], filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update records matching filters.
        """
        try:
            if not filters:
                raise DatabaseError("Update requires at least one filter")

            query = self.client.table(table).update(updates)
            
            for key, value in filters.items():
                query = query.eq(key, value)

            response = query.execute()

    async def upsert(
        self, table: str, record: Dict[str, Any], on_conflict: str = "id"
    ) -> Dict[str, Any]:
        """Supabase implementation of upsert."""
        try:
            # Explicit vertical formatting for chain
            response = self.client.table(table).upsert(record, on_conflict=on_conflict).execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            else:
                raise DatabaseError(f"Upsert failed: no data returned for {table}")
        except Exception as e:
            raise DatabaseError(f"Database upsert failed: {str(e)}") from e

    async def update(
        self, table: str, record: Dict[str, Any], filters: Dict[str, Any]
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
                raise NotFound(f"No records found to update in {table} with filters {filters}")
        except Exception as e:
            if isinstance(e, NotFound):
                raise
            raise DatabaseError(f"Database update failed: {str(e)}") from e

    async def delete(self, table: str, filters: Dict[str, Any]) -> int:
        """
        Delete records from Supabase table matching filters.

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
