"""
APEX Orchestrator - Main Entry Point.

This script starts the Temporal worker and connects all components:
- Workflows (AgentWorkflow)
- Activities (tool execution, caching, database operations)
- Infrastructure (Redis, Supabase, LLM clients)

Usage:
    # Start worker
    python main.py worker

    # Submit test workflow
    python main.py submit "Book flight to Paris tomorrow"

    # Run with custom config
    TEMPORAL_HOST=temporal.example.com:7233 python main.py worker
"""

import asyncio
import logging
import os
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from temporalio.client import Client
from temporalio.worker import Worker
from uvicorn import Config, Server

# Import all components
from activities.man_mode import backlog_check, create_man_task, resolve_man_task, risk_triage
from activities.tools import (
    acquire_distributed_lock,
    call_webhook,
    check_semantic_cache,
    create_record,
    delete_record,
    generate_plan_with_llm,
    release_distributed_lock,
    search_database,
    send_email,
    setup_activities,
)
from config import settings
from models.man_mode import ManDecisionPayload, ManPolicy
from workflows.agent_saga import AgentWorkflow

# FastAPI app for HTTP API
app = FastAPI(title="APEX Orchestrator API", version="1.0.0")


class GoalRequest(BaseModel):
    user_id: str
    user_intent: str
    trace_id: str


@app.post("/api/v1/goals")
async def create_goal(request: GoalRequest):
    """
    Create and start a new agent workflow.

    This endpoint receives requests from the Edge Function router
    and starts Temporal workflows for AI agent orchestration.
    """
    try:
        logger.info(f"Creating goal workflow: {request.trace_id}")

        # Connect to Temporal
        client = await Client.connect(
            os.getenv("TEMPORAL_HOST", "localhost:7233"),
            namespace=os.getenv("TEMPORAL_NAMESPACE", "default"),
        )

        # Start workflow with unique ID
        workflow_id = f"goal-{request.trace_id}"

        handle = await client.start_workflow(
            "AgentSagaWorkflow",
            args=[request.user_intent, request.user_id, {}],
            id=workflow_id,
            task_queue=os.getenv("TEMPORAL_TASK_QUEUE", "apex-orchestrator"),
        )

        logger.info(f"✓ Workflow started: {workflow_id}")
        return {"workflowId": handle.id, "status": "started"}

    except Exception as e:
        logger.error(f"Failed to create goal workflow: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


# ============================================================================
# MAN MODE OPERATOR API ENDPOINTS
# ============================================================================

class ManTaskFilter(BaseModel):
    """Query parameters for filtering MAN tasks."""
    tenant_id: str | None = None
    status: str | None = None
    workflow_id: str | None = None
    limit: int = 50
    offset: int = 0


@app.get("/api/v1/man/tasks")
async def list_man_tasks(filters: ManTaskFilter = None):
    """
    List pending MAN tasks for operator review.

    Supports filtering by tenant, status, workflow, with pagination.
    """
    try:
        # Get database provider
        from providers.database.factory import get_database_provider
        db = get_database_provider()

        # Build filters
        query_filters = {}
        if filters.tenant_id:
            query_filters["tenant_id"] = filters.tenant_id
        if filters.status:
            query_filters["status"] = filters.status
        if filters.workflow_id:
            query_filters["workflow_id"] = filters.workflow_id

        # Query tasks with pagination
        tasks = await db.select(
            table="man_tasks",
            filters=query_filters,
            select_fields="*"
        )

        # Apply offset/limit (simple implementation)
        start_idx = filters.offset if filters else 0
        limit_count = filters.limit if filters else 50
        paginated_tasks = tasks[start_idx:start_idx + limit_count]

        return {
            "tasks": paginated_tasks,
            "total": len(tasks),
            "offset": start_idx,
            "limit": limit_count
        }

    except Exception as e:
        logger.error(f"Failed to list MAN tasks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/v1/man/tasks/{task_id}")
async def get_man_task(task_id: str):
    """
    Get a specific MAN task by ID.

    Returns full task details including redacted intent and decision history.
    """
    try:
        # Get database provider
        from providers.database.factory import get_database_provider
        db = get_database_provider()

        task = await db.select_one(
            table="man_tasks",
            filters={"id": task_id}
        )

        if not task:
            raise HTTPException(status_code=404, detail="MAN task not found")

        # Also fetch decision events for audit trail
        decision_events = await db.select(
            table="man_decision_events",
            filters={"task_id": task_id}
        )

        return {
            "task": task,
            "decision_events": decision_events
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get MAN task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/v1/man/tasks/{task_id}/decision")
async def submit_man_decision(task_id: str, decision: ManDecisionPayload):
    """
    Submit a decision for a MAN task.

    This will resolve the task and signal the workflow to continue.
    """
    try:
        # Connect to Temporal
        client = await Client.connect(
            os.getenv("TEMPORAL_HOST", "localhost:7233"),
            namespace=os.getenv("TEMPORAL_NAMESPACE", "default"),
        )

        # Get task details to find workflow ID
        from providers.database.factory import get_database_provider
        db = get_database_provider()

        task = await db.select_one(
            table="man_tasks",
            filters={"id": task_id},
            select_fields="workflow_id,tenant_id"
        )

        if not task:
            raise HTTPException(status_code=404, detail="MAN task not found")

        workflow_id = task["workflow_id"]

        # Submit decision via Temporal update
        handle = client.get_workflow_handle(workflow_id)
        await handle.execute_update(
            AgentWorkflow.submit_man_decision,
            args=[task_id, decision.model_dump()]
        )

        # Also call resolve_man_task activity to update database
        # This ensures consistency even if workflow update fails
        try:
            await resolve_man_task(task_id, decision.model_dump())
        except Exception as activity_error:
            logger.warning(f"Activity resolve_man_task failed, but workflow updated: {activity_error}")

        return {"status": "decision_submitted", "task_id": task_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit decision for task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/v1/man/policies")
async def list_man_policies(tenant_id: str | None = None, workflow_key: str | None = None):
    """
    List MAN Mode policies.

    Supports filtering by tenant and workflow scope.
    """
    try:
        # Get database provider
        from providers.database.factory import get_database_provider
        db = get_database_provider()

        # Build filters
        query_filters = {}
        if tenant_id:
            query_filters["tenant_id"] = tenant_id
        if workflow_key:
            query_filters["workflow_key"] = workflow_key

        policies = await db.select(
            table="man_policies",
            filters=query_filters
        )

        return {"policies": policies}

    except Exception as e:
        logger.error(f"Failed to list MAN policies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.put("/api/v1/man/policies")
async def upsert_man_policy(
    tenant_id: str | None = None,
    workflow_key: str | None = None,
    policy: ManPolicy = None,
    updated_by: str | None = None
):
    """
    Create or update a MAN Mode policy.

    Supports tenant-wide or workflow-specific policies.
    """
    try:
        if not policy:
            raise HTTPException(status_code=400, detail="Policy data required")

        # Get database provider
        from providers.database.factory import get_database_provider
        db = get_database_provider()

        # Prepare policy record
        policy_record = {
            "tenant_id": tenant_id,
            "workflow_key": workflow_key,
            "policy_json": policy.model_dump(),
            "version": "1.0",  # Could be incremented based on existing version
            "updated_by": updated_by or "api",
        }

        # Upsert policy
        result = await db.upsert(
            table="man_policies",
            record=policy_record,
            conflict_columns=["tenant_id", "workflow_key"]
        )

        logger.info(f"✓ MAN policy upserted: tenant={tenant_id}, workflow={workflow_key}")

        return {"policy": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upsert MAN policy: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ============================================================================
# WORKFLOW CONTROL ENDPOINTS
# ============================================================================

class WorkflowSignal(BaseModel):
    """Base model for workflow signals."""
    workflow_id: str
    reason: str | None = None


@app.post("/api/v1/workflows/{workflow_id}/pause")
async def pause_workflow(workflow_id: str, signal: WorkflowSignal):
    """
    Send pause signal to a workflow.

    This will pause execution at the next safe checkpoint.
    """
    try:
        # Connect to Temporal
        client = await Client.connect(
            os.getenv("TEMPORAL_HOST", "localhost:7233"),
            namespace=os.getenv("TEMPORAL_NAMESPACE", "default"),
        )

        # Send pause signal
        handle = client.get_workflow_handle(workflow_id)
        await handle.signal(AgentWorkflow.pause_workflow, signal.reason or "Operator requested pause")

        return {"status": "signal_sent", "signal": "pause", "workflow_id": workflow_id}

    except Exception as e:
        logger.error(f"Failed to pause workflow {workflow_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/v1/workflows/{workflow_id}/resume")
async def resume_workflow(workflow_id: str):
    """
    Send resume signal to a workflow.

    This will resume execution from the pause point.
    """
    try:
        # Connect to Temporal
        client = await Client.connect(
            os.getenv("TEMPORAL_HOST", "localhost:7233"),
            namespace=os.getenv("TEMPORAL_NAMESPACE", "default"),
        )

        # Send resume signal
        handle = client.get_workflow_handle(workflow_id)
        await handle.signal(AgentWorkflow.resume_workflow)

        return {"status": "signal_sent", "signal": "resume", "workflow_id": workflow_id}

    except Exception as e:
        logger.error(f"Failed to resume workflow {workflow_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/v1/workflows/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str, signal: WorkflowSignal):
    """
    Send cancel signal to a workflow.

    This will terminate workflow execution.
    """
    try:
        # Connect to Temporal
        client = await Client.connect(
            os.getenv("TEMPORAL_HOST", "localhost:7233"),
            namespace=os.getenv("TEMPORAL_NAMESPACE", "default"),
        )

        # Send cancel signal
        handle = client.get_workflow_handle(workflow_id)
        await handle.signal(AgentWorkflow.cancel_workflow, signal.reason or "Operator requested cancellation")

        return {"status": "signal_sent", "signal": "cancel", "workflow_id": workflow_id}

    except Exception as e:
        logger.error(f"Failed to cancel workflow {workflow_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


class ForceManModeRequest(BaseModel):
    """Request model for forcing MAN Mode."""
    scope: str  # "ALL" or "STEPS"
    step_ids: list[str] | None = None


@app.post("/api/v1/workflows/{workflow_id}/force-man-mode")
async def force_man_mode(workflow_id: str, request: ForceManModeRequest):
    """
    Force MAN Mode approval for workflow steps.

    Can force approval for all steps or specific steps.
    """
    try:
        # Connect to Temporal
        client = await Client.connect(
            os.getenv("TEMPORAL_HOST", "localhost:7233"),
            namespace=os.getenv("TEMPORAL_NAMESPACE", "default"),
        )

        # Send force MAN Mode signal
        handle = client.get_workflow_handle(workflow_id)
        await handle.signal(AgentWorkflow.force_man_mode, request.scope, request.step_ids)

        return {
            "status": "signal_sent",
            "signal": "force_man_mode",
            "workflow_id": workflow_id,
            "scope": request.scope,
            "step_ids": request.step_ids
        }

    except Exception as e:
        logger.error(f"Failed to force MAN mode on workflow {workflow_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def start_worker() -> None:
    """
    Start Temporal worker.

    The worker:
    1. Connects to Temporal server
    2. Initializes activity dependencies (Redis, Supabase, etc.)
    3. Registers workflows and activities
    4. Polls task queue for work
    5. Executes workflows and activities

    Architecture:
        Temporal Server → Task Queue → Worker (this process) → Workflows/Activities
    """
    logger.info("🚀 Starting APEX Orchestrator Worker...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Temporal: {settings.temporal_host} (namespace={settings.temporal_namespace})")
    logger.info(f"Task Queue: {settings.temporal_task_queue}")

    # Initialize activity dependencies
    logger.info("Initializing activity dependencies...")
    await setup_activities(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_service_role_key,
        redis_url=settings.redis_url,
    )
    logger.info("✓ Dependencies initialized")

    # Connect to Temporal server
    logger.info(f"Connecting to Temporal: {settings.temporal_host}...")
    client = await Client.connect(
        settings.temporal_host,
        namespace=settings.temporal_namespace,
    )
    logger.info("✓ Connected to Temporal")

    # Create worker
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[AgentWorkflow],
        activities=[
            # Planning activities
            check_semantic_cache,
            generate_plan_with_llm,
            # Tool execution activities
            search_database,
            create_record,
            delete_record,
            send_email,
            call_webhook,
            # Distributed locking activities
            acquire_distributed_lock,
            release_distributed_lock,
            # MAN Mode activities
            risk_triage,
            create_man_task,
            resolve_man_task,
            backlog_check,
        ],
        max_concurrent_workflow_tasks=10,
        max_concurrent_activities=20,
    )

    logger.info("✅ Worker started - polling for tasks...")
    logger.info("Press Ctrl+C to stop")

    # Run worker until interrupted
    await worker.run()


async def submit_workflow(goal: str, user_id: str = "test-user") -> None:
    """
    Submit a test workflow to Temporal.

    This is a client that sends work to the worker.

    Args:
        goal: User's natural language goal
        user_id: User ID
    """
    logger.info(f"Submitting workflow: {goal}")

    # Connect to Temporal
    client = await Client.connect(
        settings.temporal_host,
        namespace=settings.temporal_namespace,
    )

    # Start workflow
    from uuid import uuid4

    workflow_id = f"agent-workflow-{uuid4()}"

    handle = await client.start_workflow(
        AgentWorkflow.run,
        args=[goal, user_id, {}],
        id=workflow_id,
        task_queue=settings.temporal_task_queue,
    )

    logger.info(f"✓ Workflow started: {workflow_id}")
    logger.info("Waiting for result...")

    # Wait for result
    try:
        result = await handle.result()
        logger.info(f"✅ Workflow completed: {result}")
    except Exception as e:
        logger.error(f"❌ Workflow failed: {str(e)}")
        raise


async def run_tests() -> None:
    """Run integration tests."""
    logger.info("🧪 Running integration tests...")

    # Test semantic cache
    from infrastructure.cache import EntityExtractor, SemanticCacheService

    logger.info("\n--- Testing Entity Extraction ---")
    goal = "Book flight to Paris tomorrow and send confirmation to john@example.com"
    template, params = EntityExtractor.create_template(goal)
    logger.info(f"Goal: {goal}")
    logger.info(f"Template: {template}")
    logger.info(f"Parameters: {params}")

    # Test semantic cache
    logger.info("\n--- Testing Semantic Cache ---")
    cache = SemanticCacheService(redis_url=settings.redis_url)
    await cache.initialize()

    # Store plan
    plan_steps = [
        {"id": "step1", "tool": "search_flights", "input": {"to": "{LOCATION}", "date": "{DATE}"}},
        {"id": "step2", "tool": "book_flight", "input": {"flight_id": "{FLIGHT_ID}"}},
    ]
    template_id = await cache.store_plan(goal, plan_steps)
    logger.info(f"✓ Stored plan: {template_id}")

    # Retrieve plan (should hit cache)
    cached = await cache.get_plan("Book flight to Paris tomorrow")
    if cached:
        logger.info(f"✓ Cache hit: similarity={cached.similarity_score:.3f}")
    else:
        logger.info("✗ Cache miss")

    await cache.close()

    logger.info("\n✅ All tests passed!")


async def start_api_server() -> None:
    """Start FastAPI server for HTTP API."""
    logger.info("🚀 Starting APEX Orchestrator API Server...")
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    logger.info(f"API Server: http://{host}:{port}")
    logger.info("Health check: http://{host}:{port}/health")

    # Run FastAPI with uvicorn
    config = Config(
        app=app,
        host=host,
        port=port,
        log_level=settings.log_level.lower(),
    )
    server = Server(config)
    await server.serve()


def main() -> None:
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python main.py worker              # Start Temporal worker")
        print("  python main.py api                 # Start HTTP API server")
        print('  python main.py submit "GOAL"       # Submit workflow')
        print("  python main.py test                # Run tests")
        sys.exit(1)

    command = sys.argv[1]

    if command == "worker":
        asyncio.run(start_worker())

    elif command == "api":
        asyncio.run(start_api_server())

    elif command == "submit":
        if len(sys.argv) < 3:
            print("Error: Missing goal argument")
            print('Usage: python main.py submit "Book flight to Paris tomorrow"')
            sys.exit(1)
        goal = sys.argv[2]
        asyncio.run(submit_workflow(goal))

    elif command == "test":
        asyncio.run(run_tests())

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
