"""
Database Provider Interface.

Defines the contract for database operations used by orchestrator activities.
This enables portability between different database backends (Supabase, PostgreSQL, etc.)
while maintaining consistent behavior and error handling.
"""

from typing import Any, Dict, List, Optional, Protocol


class DatabaseError(Exception):
    """Base exception for database operations."""

    pass


class NotFoundError(DatabaseError):
    """Raised when a requested record is not found."""

    pass


class DatabaseProvider(Protocol):
    """
    Protocol defining the database provider interface.

    All database operations used by orchestrator activities must implement this interface.
    """

    async def select(
        self,
        table: str,
        filters: Optional[Dict[str, Any]] = None,
        select_fields: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Select records from a table with optional filtering.

        Args:
            table: Table name to query
            filters: Dictionary of field-value pairs to filter by (equality only)
            select_fields: Comma-separated field names to select (None = all fields)

        Returns:
            List of matching records as dictionaries

        Raises:
            NotFound: If no records match the filters
            DatabaseError: For other database errors
        """
        ...

    async def insert(self, table: str, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Insert a new record into a table.

        Args:
            table: Table name to insert into
            record: Record data as a dictionary

        Returns:
            The inserted record (including any generated fields like IDs)

        Raises:
            DatabaseError: For database errors
        """
        ...

    async def delete(self, table: str, filters: Dict[str, Any]) -> int:
        """
        Delete records from a table matching the filters.

        Args:
            table: Table name to delete from
            filters: Dictionary of field-value pairs to match (equality only)

        Returns:
            Number of records deleted

        Raises:
            DatabaseError: For database errors
        """
        ...

    async def upsert(
        self, table: str, record: Dict[str, Any], conflict_columns: List[str]
    ) -> Dict[str, Any]:
        """
        Insert or update a record (upsert) based on conflict resolution.

        Args:
            table: Table name to upsert into
            record: Record data as a dictionary
            conflict_columns: Columns to check for conflicts (ON CONFLICT clause)

        Returns:
            The upserted record

        Raises:
            DatabaseError: For database errors
        """
        ...

    async def update(
        self, table: str, filters: Dict[str, Any], updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update records matching the filters.

        Args:
            table: Table name to update
            filters: Dictionary of field-value pairs to match (WHERE clause)
            updates: Dictionary of field-value pairs to update (SET clause)

        Returns:
            The updated record if exactly one was updated, None otherwise

        Raises:
            DatabaseError: For database errors
        """
        ...

    async def select_one(
        self, table: str, filters: Dict[str, Any], select_fields: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Select a single record from a table with filtering.

        Args:
            table: Table name to query
            filters: Dictionary of field-value pairs to filter by (equality only)
            select_fields: Comma-separated field names to select (None = all fields)

        Returns:
            Single matching record as dictionary, or None if not found

        Raises:
            DatabaseError: For database errors
        """
        ...
