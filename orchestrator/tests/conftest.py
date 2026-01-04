"""Pytest configuration and fixtures."""

import asyncio
import os
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio

# Set test environment variables
os.environ["ENVIRONMENT"] = "test"
os.environ["LOG_LEVEL"] = "DEBUG"
os.environ["SUPABASE_URL"] = "http://localhost:54321"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-key"
os.environ["SUPABASE_DB_URL"] = "postgresql://postgres:postgres@localhost:54322/postgres"
os.environ["REDIS_URL"] = "redis://localhost:6379"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def temporal_env() -> AsyncGenerator:
    """
    Create isolated Temporal test environment.

    This is a local in-memory Temporal server for testing (no Docker required).
    Requires temporalio package - skipped if not installed.
    """
    try:
        from temporalio.testing import WorkflowEnvironment

        async with await WorkflowEnvironment.start_time_skipping() as env:
            yield env
    except ImportError:
        pytest.skip("temporalio not installed - skipping workflow tests")
        yield None
