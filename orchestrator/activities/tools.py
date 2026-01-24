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
import time
from typing import Any
from uuid import uuid4

import instructor
from litellm import acompletion
from pydantic import BaseModel
from temporalio import activity

from models.audit import AuditAction, AuditResourceType, AuditStatus, log_audit_event
from providers.database.factory import get_database_provider
from security.prompt_sanitizer import PromptInjectionError, create_safe_user_message

# Global service instances (initialized in setup_activities())
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
    Initialize activity dependencies (database provider, Redis, etc.).

    This MUST be called before starting Temporal worker.

    Args:
        supabase_url: Supabase project URL
        supabase_key: Supabase service role key
        redis_url: Redis connection URL
    """
    global _semantic_cache, _redis_client

    # Set environment variables for database provider factory
    os.environ["SUPABASE_URL"] = supabase_url
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = supabase_key

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
async def check_semantic_cache(goal: str) -> dict[str, Any] | None:
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
    compensation: str | None = None
    compensation_input: dict[str, Any] | None = None


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
4. Use available tools:
   - search_database
   - send_email
   - book_flight
   - create_record
   - webhook
   - search_youtube

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
        # SECURITY: Sanitize user input to prevent prompt injection
        # CVE fix: Never interpolate raw user input into prompts
        try:
            safe_user_message = create_safe_user_message(goal, context)
        except PromptInjectionError as e:
            activity.logger.warning(f"Prompt injection blocked: {e.pattern}")
            from temporalio.exceptions import ApplicationError

            raise ApplicationError(
                "Request rejected: potential prompt injection detected",
                non_retryable=True,  # Don't retry injection attempts
            ) from e

        plan = await client.chat.completions.create(
            model=os.getenv("DEFAULT_LLM_MODEL", "gpt-4-turbo-preview"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": safe_user_message},
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
    Search database using provider interface.

    Example tool demonstrating database integration with Temporal resilience.

    Args:
        params: {
            "table": "profiles",
            "filters": {"email": "user@example.com"},
            "select": "id,full_name,avatar_url"
        }

    Returns:
        Query results
    """
    table = params.get("table")
    filters = params.get("filters", {})
    select_fields = params.get("select", "*")
    start_time = time.time()

    activity.logger.info(f"Searching {table} with filters: {filters}")

    error_msg = None
    result_count = 0

    try:
        # Get database provider instance
        db = get_database_provider()

        # Perform select operation
        data = await db.select(table=table, filters=filters, select_fields=select_fields)

        result_count = len(data)

        # Audit success
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.DATA_ACCESS,
            resource_type=AuditResourceType.DATABASE,
            resource_id=f"{table}:{json.dumps(filters)}",
            status=AuditStatus.SUCCESS,
            duration_ms=int((time.time() - start_time) * 1000),
            workflow_id=params.get("workflow_id", ""),
        )

        return {
            "success": True,
            "data": data,
            "count": result_count,
        }

    except Exception as e:
        error_msg = str(e)
        activity.logger.error(f"Database search failed: {error_msg}")

        # Audit failure
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.DATA_ACCESS,
            resource_type=AuditResourceType.DATABASE,
            resource_id=f"{table}:{json.dumps(filters)}",
            status=AuditStatus.FAILURE,
            duration_ms=int((time.time() - start_time) * 1000),
            workflow_id=params.get("workflow_id", ""),
        )

        # Use ApplicationError for retryable failures (network timeouts, temporary unavailability)
        from temporalio.exceptions import ApplicationError

        raise ApplicationError(f"Database search failed: {error_msg}", non_retryable=False) from e


@activity.defn(name="create_record")
async def create_record(params: dict[str, Any]) -> dict[str, Any]:
    """
    Create record in database.

    Compensation: delete_record

    Args:
        params: {
            "table": "integrations",
            "data": {"type": "slack", "name": "My Slack", "config": {...}}
        }

    Returns:
        Created record with ID
    """
    table = params.get("table")
    data = params.get("data")
    start_time = time.time()

    activity.logger.info(f"Creating record in {table}")

    error_msg = None
    record_id = None

    try:
        # Get database provider instance
        db = get_database_provider()

        # Perform insert operation
        created = await db.insert(table=table, record=data)

        record_id = created.get("id")

        # Audit success
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.DATA_MODIFY,
            resource_type=AuditResourceType.DATABASE,
            resource_id=f"{table}:{record_id}",
            status=AuditStatus.SUCCESS,
            duration_ms=int((time.time() - start_time) * 1000),
            workflow_id=params.get("workflow_id", ""),
        )

        return {
            "success": True,
            "id": record_id,
            "data": created,
        }

    except Exception as e:
        error_msg = str(e)
        activity.logger.error(f"Record creation failed: {error_msg}")

        # Audit failure
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.DATA_MODIFY,
            resource_type=AuditResourceType.DATABASE,
            resource_id=f"{table}:create",
            status=AuditStatus.FAILURE,
            duration_ms=int((time.time() - start_time) * 1000),
            workflow_id=params.get("workflow_id", ""),
        )

        raise


@activity.defn(name="delete_record")
async def delete_record(params: dict[str, Any]) -> dict[str, Any]:
    """
    Delete record from database (compensation for create_record).

    IMPORTANT: This is idempotent - safe to call multiple times.

    Args:
        params: {
            "table": "integrations",
            "id": "uuid-here"
        }

    Returns:
        Deletion result
    """
    table = params.get("table")
    record_id = params.get("id")
    start_time = time.time()

    activity.logger.info(f"Deleting record from {table}: {record_id}")

    error_msg = None

    try:
        # Get database provider instance
        db = get_database_provider()

        # Delete record by ID filter
        deleted_count = await db.delete(table=table, filters={"id": record_id})

        # Audit success
        await log_audit_event(
            actor_id="orchestrator",
            action=AuditAction.DATA_DELETE,
            resource_type=AuditResourceType.DATABASE,
            resource_id=f"{table}:{record_id}",
            status=AuditStatus.SUCCESS,
            duration_ms=int((time.time() - start_time) * 1000),
            workflow_id=params.get("workflow_id", ""),
        )

        if deleted_count == 0:
            activity.logger.info("Record already deleted - idempotent success")
            return {"success": True, "already_deleted": True}

        return {
            "success": True,
            "deleted_id": record_id,
        }

    except Exception as e:
        error_msg = str(e)
        activity.logger.error(f"Record deletion failed: {error_msg}")

        # Audit failure (best-effort - don't block compensation)
        try:
            await log_audit_event(
                actor_id="orchestrator",
                action=AuditAction.DATA_DELETE,
                resource_type=AuditResourceType.DATABASE,
                resource_id=f"{table}:{record_id}",
                status=AuditStatus.FAILURE,
                duration_ms=int((time.time() - start_time) * 1000),
                workflow_id=params.get("workflow_id", ""),
            )
        except Exception as audit_error:
            activity.logger.warning(f"Audit logging failed: {audit_error}")

        # Don't raise - best-effort compensation
        return {"success": False, "error": error_msg}


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


@activity.defn(name="search_youtube")
async def search_youtube(params: dict[str, Any]) -> dict[str, Any]:
    """
    Search YouTube for videos.

    Args:
        params: {
            "query": "funny cats"
        }

    Returns:
        List of videos
    """
    query = params.get("query")
    activity.logger.info(f"Searching YouTube for: {query}")

    # Mock response
    return {
        "success": True,
        "videos": [
            {
                "title": f"Video about {query}",
                "url": "https://youtube.com/watch?v=mock123",
                "description": "A very interesting video",
            }
        ],
    }


@activity.defn(name="update_agent_run_completion")
async def update_agent_run_completion(params: dict[str, Any]) -> dict[str, Any]:
    """
    Update agent_runs table with workflow completion status and response.

    Called when workflow completes successfully to notify UI via realtime subscription.

    Args:
        params: {
            "trace_id": "uuid-of-agent-run",
            "status": "completed" | "failed",
            "agent_response": {...}  # Final workflow result or error details
        }

    Returns:
        Update result
    """
    trace_id = params.get("trace_id")
    status = params.get("status")
    agent_response = params.get("agent_response", {})

    activity.logger.info(f"Updating agent_run completion: {trace_id} -> {status}")

    try:
        # Get database provider instance
        db = get_database_provider()

        # Prepare update data
        update_data = {
            "status": status,
            "end_time": "now()",  # Use database function for current timestamp
        }

        if status == "completed":
            update_data["agent_response"] = json.dumps(agent_response)
        elif status == "failed":
            update_data["error_message"] = str(agent_response.get("error", "Unknown error"))

        # Update the agent_run record
        updated = await db.update(
            table="agent_runs",
            updates=update_data,
            filters={"id": trace_id}
        )

        activity.logger.info(f"✓ Updated agent_run {trace_id} with status {status}")

        return {
            "success": True,
            "updated_id": trace_id,
            "status": status,
        }

    except Exception as e:
        error_msg = str(e)
        activity.logger.error(f"Failed to update agent_run completion: {error_msg}")

        # Don't raise - this is best-effort notification to UI
        return {
            "success": False,
            "error": error_msg,
            "trace_id": trace_id,
        }


# ============================================================================
# DISTRIBUTED RELIABILITY - Using Temporal's Built-in Mechanisms
# ============================================================================

# NOTE: Manual distributed locking removed. Use Temporal's built-in workflow
# serialization and Signals for critical sections instead of Redis-based locks.
# This eliminates race conditions and simplifies the architecture.

# For critical sections requiring serialization:
# 1. Use Workflow Signals to coordinate between workflow instances
# 2. Use Temporal's built-in workflow mutexes for resource locking
# 3. Leverage Saga patterns for compensation-based error handling

# Example: Instead of manual locking, use workflow signals:
# await workflow.wait_condition(lambda: workflow_state.is_ready)
# signal = workflow.get_external_signal("resource_available")
# await signal
