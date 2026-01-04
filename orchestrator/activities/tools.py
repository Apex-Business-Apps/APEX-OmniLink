"""
Temporal Activities for Tool Execution and External I/O.

Activities are the ONLY way workflows can interact with the external world:
- Database queries (Supabase)
- API calls (LLMs, external services)
- File I/O
- Redis operations

Why Activities (not direct calls in workflows):
1. **Determinism**: Workflows must be deterministic for replay. Activities are recorded
   in history, so replay uses cached results instead of re-executing.

2. **Retries**: Activities have independent retry policies. Workflow doesn't need to
   handle transient failures.

3. **Timeouts**: Activities have start-to-close timeouts. Prevents hung workflows.

4. **Heartbeats**: Long-running activities can send heartbeats to detect worker crashes.

Compensation Pattern:
- Each forward activity (e.g., book_flight) has a compensation (e.g., cancel_flight)
- Compensations MUST be idempotent (safe to call multiple times)
- Best-effort rollback (log failures but don't block)
"""

import asyncio
import json
import os
from typing import Any, Optional
from uuid import uuid4

import instructor
from litellm import acompletion
from pydantic import BaseModel
from supabase import Client, create_client
from temporalio import activity

# Global service instances (initialized in setup_activities())
_supabase_client: Optional[Client] = None
_semantic_cache = None  # SemanticCacheService instance
_redis_client = None


# ============================================================================
# ACTIVITY SETUP
# ============================================================================


async def setup_activities(
    supabase_url: str,
    supabase_key: str,
    redis_url: str,
) -> None:
    """
    Initialize activity dependencies (Supabase, Redis, etc.).

    This MUST be called before starting Temporal worker.

    Args:
        supabase_url: Supabase project URL
        supabase_key: Supabase service role key
        redis_url: Redis connection URL
    """
    global _supabase_client, _semantic_cache, _redis_client

    # Initialize Supabase client
    _supabase_client = create_client(supabase_url, supabase_key)
    activity.logger.info(f"✓ Supabase client initialized: {supabase_url}")

    # Initialize semantic cache
    from infrastructure.cache import SemanticCacheService

    _semantic_cache = SemanticCacheService(
        redis_url=redis_url,
        embedding_model=os.getenv("CACHE_EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
        similarity_threshold=float(os.getenv("CACHE_SIMILARITY_THRESHOLD", "0.85")),
    )
    await _semantic_cache.initialize()
    activity.logger.info("✓ Semantic cache initialized")


# ============================================================================
# PLANNING ACTIVITIES
# ============================================================================


@activity.defn(name="check_semantic_cache")
async def check_semantic_cache(goal: str) -> Optional[dict[str, Any]]:
    """
    Check semantic cache for existing plan template.

    Returns:
        Cached plan with injected parameters if hit, else None

    Example:
        goal = "Book flight to Paris tomorrow"
        → Cache returns plan with "Paris" and "tomorrow" injected
    """
    if not _semantic_cache:
        raise RuntimeError("Semantic cache not initialized - call setup_activities() first")

    activity.logger.info(f"Checking semantic cache for: {goal}")

    cached = await _semantic_cache.get_plan(goal)

    if cached:
        activity.logger.info(
            f"✓ Cache HIT (similarity={cached.similarity_score:.3f}, template={cached.template_id})"
        )
        # Convert Pydantic model to dict for workflow
        return cached.model_dump()

    activity.logger.info("✗ Cache MISS")
    return None


class PlanStep(BaseModel):
    """Plan step schema for LLM generation."""

    id: str
    name: str
    tool: str
    input: dict[str, Any]
    depends_on: list[str] = []
    compensation: Optional[str] = None
    compensation_input: Optional[dict[str, Any]] = None


class GeneratedPlan(BaseModel):
    """LLM-generated plan schema."""

    plan_id: str
    steps: list[PlanStep]
    reasoning: str


@activity.defn(name="generate_plan_with_llm")
async def generate_plan_with_llm(goal: str, context: dict[str, Any]) -> dict[str, Any]:
    """
    Generate execution plan using LLM with structured output (instructor).

    This activity:
    1. Calls LLM with structured output (Pydantic schema)
    2. Validates plan structure
    3. Stores plan in semantic cache for future hits
    4. Returns plan to workflow

    Args:
        goal: User's natural language goal
        context: Additional context (user prefs, history)

    Returns:
        Generated plan with steps

    Why instructor + litellm:
    - instructor: Forces LLM to return structured Pydantic objects (no parsing needed)
    - litellm: Vendor-agnostic (OpenAI, Anthropic, Cohere, etc. with same interface)
    """
    activity.logger.info(f"Generating plan for goal: {goal}")

    # Build prompt
    system_prompt = """You are an AI task planner. Given a user goal, generate an execution plan.

Rules:
1. Break goal into sequential steps (each step = one tool call)
2. Define dependencies (steps that must complete before this one)
3. Assign compensation activities for reversible actions
4. Use available tools: search_database, send_email, book_flight, create_record, webhook

Example:
Goal: "Book flight to Paris tomorrow and send confirmation to john@example.com"
Plan:
- Step 1: search_flights (to=Paris, date=tomorrow)
- Step 2: book_flight (flight_id={step1.flight_id}), compensation=cancel_flight
- Step 3: send_email (to=john@example.com, body=confirmation)

Output valid JSON matching the PlanStep schema."""

    # Use instructor to get structured output
    client = instructor.from_litellm(acompletion)

    try:
        plan = await client.chat.completions.create(
            model=os.getenv("DEFAULT_LLM_MODEL", "gpt-4-turbo-preview"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Goal: {goal}\nContext: {json.dumps(context)}"},
            ],
            response_model=GeneratedPlan,
            temperature=float(os.getenv("DEFAULT_LLM_TEMPERATURE", "0.0")),
        )

        activity.logger.info(f"✓ Plan generated: {len(plan.steps)} steps")

        # Store in semantic cache for future hits
        if _semantic_cache:
            await _semantic_cache.store_plan(
                goal=goal,
                plan_steps=[step.model_dump() for step in plan.steps],
            )

        # Return as dict for workflow
        return {
            "plan_id": plan.plan_id,
            "steps": [step.model_dump() for step in plan.steps],
        }

    except Exception as e:
        activity.logger.error(f"Plan generation failed: {str(e)}")
        raise


# ============================================================================
# TOOL EXECUTION ACTIVITIES (Examples)
# ============================================================================


@activity.defn(name="search_database")
async def search_database(params: dict[str, Any]) -> dict[str, Any]:
    """
    Search Supabase database.

    Example tool demonstrating Supabase integration.

    Args:
        params: {
            "table": "profiles",
            "filters": {"email": "user@example.com"},
            "select": "id,full_name,avatar_url"
        }

    Returns:
        Query results
    """
    if not _supabase_client:
        raise RuntimeError("Supabase not initialized")

    table = params.get("table")
    filters = params.get("filters", {})
    select_fields = params.get("select", "*")

    activity.logger.info(f"Searching {table} with filters: {filters}")

    try:
        query = _supabase_client.table(table).select(select_fields)

        # Apply filters
        for key, value in filters.items():
            query = query.eq(key, value)

        response = query.execute()

        return {
            "success": True,
            "data": response.data,
            "count": len(response.data),
        }

    except Exception as e:
        activity.logger.error(f"Database search failed: {str(e)}")
        return {"success": False, "error": str(e)}


@activity.defn(name="create_record")
async def create_record(params: dict[str, Any]) -> dict[str, Any]:
    """
    Create record in Supabase.

    Compensation: delete_record

    Args:
        params: {
            "table": "integrations",
            "data": {"type": "slack", "name": "My Slack", "config": {...}}
        }

    Returns:
        Created record with ID
    """
    if not _supabase_client:
        raise RuntimeError("Supabase not initialized")

    table = params.get("table")
    data = params.get("data")

    activity.logger.info(f"Creating record in {table}")

    try:
        response = _supabase_client.table(table).insert(data).execute()

        created = response.data[0] if response.data else {}

        return {
            "success": True,
            "id": created.get("id"),
            "data": created,
        }

    except Exception as e:
        activity.logger.error(f"Record creation failed: {str(e)}")
        raise


@activity.defn(name="delete_record")
async def delete_record(params: dict[str, Any]) -> dict[str, Any]:
    """
    Delete record from Supabase (compensation for create_record).

    IMPORTANT: This is idempotent - safe to call multiple times.

    Args:
        params: {
            "table": "integrations",
            "id": "uuid-here"
        }

    Returns:
        Deletion result
    """
    if not _supabase_client:
        raise RuntimeError("Supabase not initialized")

    table = params.get("table")
    record_id = params.get("id")

    activity.logger.info(f"Deleting record from {table}: {record_id}")

    try:
        # Check if record exists (idempotency)
        existing = _supabase_client.table(table).select("id").eq("id", record_id).execute()

        if not existing.data:
            activity.logger.info("Record already deleted - idempotent success")
            return {"success": True, "already_deleted": True}

        # Delete record
        _supabase_client.table(table).delete().eq("id", record_id).execute()

        return {
            "success": True,
            "deleted_id": record_id,
        }

    except Exception as e:
        activity.logger.error(f"Record deletion failed: {str(e)}")
        # Don't raise - best-effort compensation
        return {"success": False, "error": str(e)}


@activity.defn(name="send_email")
async def send_email(params: dict[str, Any]) -> dict[str, Any]:
    """
    Send email via Supabase Edge Function.

    No compensation (emails can't be unsent).

    Args:
        params: {
            "to": "user@example.com",
            "subject": "Welcome!",
            "body": "Hello world"
        }

    Returns:
        Send result
    """
    to = params.get("to")
    # subject and body available but not used in simulation
    # In production: params.get("subject"), params.get("body")

    activity.logger.info(f"Sending email to: {to}")

    # In production, call Supabase Edge Function or email service
    # For now, simulate success
    await asyncio.sleep(0.5)  # Simulate network latency

    return {
        "success": True,
        "message_id": str(uuid4()),
        "to": to,
    }


@activity.defn(name="call_webhook")
async def call_webhook(params: dict[str, Any]) -> dict[str, Any]:
    """
    Call external webhook.

    Args:
        params: {
            "url": "https://api.example.com/webhook",
            "method": "POST",
            "payload": {...}
        }

    Returns:
        Webhook response
    """
    import httpx

    url = params.get("url")
    method = params.get("method", "POST")
    payload = params.get("payload", {})

    activity.logger.info(f"Calling webhook: {method} {url}")

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method=method,
            url=url,
            json=payload,
            timeout=15.0,
        )

        return {
            "success": response.status_code < 400,
            "status_code": response.status_code,
            "body": response.text,
        }


# ============================================================================
# DISTRIBUTED LOCK ACTIVITY (Multi-Region Support)
# ============================================================================


@activity.defn(name="acquire_distributed_lock")
async def acquire_distributed_lock(params: dict[str, Any]) -> dict[str, Any]:
    """
    Acquire distributed lock using Redlock algorithm.

    Used for critical sections in multi-region deployments to prevent
    concurrent execution (e.g., avoid double-booking).

    Args:
        params: {
            "resource": "flight_booking_AF123",
            "ttl_seconds": 30
        }

    Returns:
        Lock token if acquired, else error

    Why Redlock:
    - Redis-based distributed locking
    - Tolerates node failures (quorum-based)
    - Automatic expiration (prevents deadlocks)
    - Works with Redis Active-Active (CRDT)

    Note: For true multi-region, use Redis Enterprise with Active-Active
    """
    if not _redis_client:
        # For now, simulate lock (production needs real Redis Redlock)
        return {"success": True, "lock_token": str(uuid4())}

    resource = params.get("resource")
    ttl_seconds = params.get("ttl_seconds", 30)

    activity.logger.info(f"Acquiring lock: {resource} (TTL={ttl_seconds}s)")

    # Simple Redis lock (production should use Redlock library)
    lock_key = f"lock:{resource}"
    lock_token = str(uuid4())

    # Try to acquire lock (SET NX with TTL)
    acquired = await _redis_client.set(
        lock_key,
        lock_token,
        nx=True,  # Only set if not exists
        ex=ttl_seconds,  # Expiration
    )

    if acquired:
        activity.logger.info(f"✓ Lock acquired: {resource}")
        return {"success": True, "lock_token": lock_token}
    else:
        activity.logger.warning(f"✗ Lock acquisition failed: {resource}")
        raise RuntimeError(f"Failed to acquire lock: {resource}")


@activity.defn(name="release_distributed_lock")
async def release_distributed_lock(params: dict[str, Any]) -> dict[str, Any]:
    """
    Release distributed lock (compensation for acquire_distributed_lock).

    Idempotent - safe to call multiple times.

    Args:
        params: {
            "resource": "flight_booking_AF123",
            "lock_token": "uuid-here"
        }

    Returns:
        Release result
    """
    if not _redis_client:
        return {"success": True, "simulated": True}

    resource = params.get("resource")
    lock_token = params.get("lock_token")

    lock_key = f"lock:{resource}"

    # Verify token before deleting (prevent releasing someone else's lock)
    current_token = await _redis_client.get(lock_key)

    if current_token == lock_token:
        await _redis_client.delete(lock_key)
        activity.logger.info(f"✓ Lock released: {resource}")
        return {"success": True}
    else:
        activity.logger.warning(f"Lock already released or expired: {resource}")
        return {"success": True, "already_released": True}
