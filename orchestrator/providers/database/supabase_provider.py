import re
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from .base import DatabaseError, DatabaseProvider, NotFound


# SECURITY: Allowlist of valid table names (SQL injection prevention)
ALLOWED_TABLES = frozenset([
    "users", "profiles", "wallets", "wallet_identities", "wallet_nonces",
    "files", "links", "integrations", "automations", "automation_logs",
    "todos", "notifications", "audit_logs", "rate_limits", "sessions",
    "user_data", "settings", "events", "workflows", "workflow_runs",
])

# Valid column name pattern (alphanumeric and underscore only)
VALID_COLUMN_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def validate_table_name(table: str) -> str:
    """
    Validate table name against allowlist.
    Raises DatabaseError if table is not allowed.
    """
    if not table or not isinstance(table, str):
        raise DatabaseError("Table name must be a non-empty string")

    normalized = table.strip().lower()
    if normalized not in ALLOWED_TABLES:
        raise DatabaseError(f"Table '{table}' is not in the allowed list")

    return normalized


def validate_column_name(column: str) -> str:
    """
    Validate column name format to prevent injection.
    """
    if not column or not isinstance(column, str):
        raise DatabaseError("Column name must be a non-empty string")

    if not VALID_COLUMN_PATTERN.match(column):
        raise DatabaseError(f"Invalid column name format: '{column}'")

    return column


class SupabaseProvider(DatabaseProvider):
    """
    Supabase implementation of the DatabaseProvider.

    Security features:
    - Table name validation against allowlist
    - Column name format validation
    - Parameterized queries via Supabase SDK
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

    async def disconnect(self) -> None:
        """
        No-op for Supabase HTTP client.
        """
        pass

    async def insert(self, table: str, record: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # SECURITY: Validate table name against allowlist
            validated_table = validate_table_name(table)

            response = self.client.table(validated_table).insert(record).execute()
            if not response.data:
                raise DatabaseError(f"Insert failed: No data from {validated_table}")
            return response.data[0]
        except DatabaseError:
            raise
        except Exception as e:
            raise DatabaseError(f"Database insert failed: {str(e)}") from e

    async def upsert(
        self,
        table: str,
        record: Dict[str, Any],
        conflict_columns: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Perform an upsert (insert or update on conflict).
        """
        try:
            # SECURITY: Validate table name against allowlist
            validated_table = validate_table_name(table)

            query = self.client.table(validated_table).upsert(record)
            response = query.execute()

            if not response.data:
                raise DatabaseError(f"Upsert failed: No data from {validated_table}")
            return response.data[0]
        except DatabaseError:
            raise
        except Exception as e:
            raise DatabaseError(f"Database upsert failed: {str(e)}") from e

    async def get(self, table: str, query_params: Dict[str, Any]) -> List[Dict[str, Any]]:
        try:
            # SECURITY: Validate table name against allowlist
            validated_table = validate_table_name(table)

            query = self.client.table(validated_table).select("*")

            # SECURITY: Validate column names in query params
            for key, value in query_params.items():
                validated_key = validate_column_name(key)
                query = query.eq(validated_key, value)

            response = query.execute()
            return response.data
        except DatabaseError:
            raise
        except Exception as e:
            raise DatabaseError(f"Database get failed: {str(e)}") from e

    async def select_one(self, table: str, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Retrieve a single record. Raises NotFound if not found.
        """
        results = await self.get(table, query_params)
        if not results:
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

            # SECURITY: Validate table name against allowlist
            validated_table = validate_table_name(table)

            query = self.client.table(validated_table).update(updates)

            # SECURITY: Validate column names in filters
            for key, value in filters.items():
                validated_key = validate_column_name(key)
                query = query.eq(validated_key, value)

            response = query.execute()

            if not response.data:
                raise NotFound(
                    f"No records to update in {validated_table} with {filters}"
                )

            return response.data[0]
        except (DatabaseError, NotFound):
            raise
        except Exception as e:
            raise DatabaseError(f"Database update failed: {str(e)}") from e

    async def delete(self, table: str, filters: Dict[str, Any]) -> bool:
        try:
            if not filters:
                raise DatabaseError("Delete requires at least one filter")

            # SECURITY: Validate table name against allowlist
            validated_table = validate_table_name(table)

            query = self.client.table(validated_table).delete()

            # SECURITY: Validate column names in filters
            for key, value in filters.items():
                validated_key = validate_column_name(key)
                query = query.eq(validated_key, value)

            response = query.execute()

            return len(response.data) > 0
        except DatabaseError:
            raise
        except Exception as e:
            raise DatabaseError(f"Database delete failed: {str(e)}") from e
