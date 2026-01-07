"""
Database Provider Interface.

Defines the contract for database operations used by orchestrator activities.
This enables portability between different database backends (Supabase, PostgreSQL, etc.)
while maintaining consistent behavior and error handling.
"""

from abc import abstractmethod
from typing import Any, Dict, List, Optional, Protocol


class DatabaseError(Exception):
    """Base exception for database operations."""
    pass


class NotFound(DatabaseError):  # noqa: N818
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
        select_fields: Optional[str] = None
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

    @abstractmethod
    async def upsert(
        self,
        table: str,
        record: Dict[str, Any],
        on_conflict: str = "id"
    ) -> Dict[str, Any]:
        """Upsert a record (Insert or Update on conflict)."""
        pass

    @abstractmethod
    async def update(
        self,
        table: str,
        record: Dict[str, Any],
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update specific fields of records matching filters."""
        pass

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
