"""
Database Provider Factory.

Provides a singleton database provider instance based on configuration.
This enables runtime switching between different database backends.
"""

import os
from typing import Optional

from .base import DatabaseProvider
from .supabase_provider import SupabaseDatabaseProvider

# Global singleton instance
_db_provider: Optional[DatabaseProvider] = None


def get_database_provider() -> DatabaseProvider:
    """
    Get the configured database provider instance.

    Uses singleton pattern to ensure consistent provider across the application.
    Configuration is read from environment variables.

    Returns:
        Configured DatabaseProvider instance

    Raises:
        ValueError: If required configuration is missing or invalid provider specified
    """
    global _db_provider

    if _db_provider is not None:
        return _db_provider

    # Read configuration
    provider_type = os.getenv("DB_PROVIDER", "supabase").lower()

    if provider_type == "supabase":
        # Get Supabase configuration
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "Supabase database provider requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables"
            )

        _db_provider = SupabaseDatabaseProvider(
            url=supabase_url,
            key=supabase_key
        )

    else:
        raise ValueError(f"Unsupported database provider: {provider_type}")

    return _db_provider


def reset_database_provider() -> None:
    """
    Reset the database provider singleton.

    Useful for testing or when configuration changes.
    """
    global _db_provider
    _db_provider = None
