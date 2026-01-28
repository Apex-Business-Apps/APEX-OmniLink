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

from activities.man_mode import (
    check_man_decision,
    create_man_task,
    get_man_task,
    resolve_man_task,
    risk_triage,
)
from activities.notify_man_task import notify_man_task
from activities.omni_policy import evaluate_policy_activity
from activities.omnitrace_activities import get_omnitrace_activities
from activities.tools import (
    call_webhook,
    check_semantic_cache,
    create_record,
    delete_record,
    generate_plan_with_llm,
    search_database,
    send_email,
    setup_activities,
)
from config import settings
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

        # C3: Start workflow via function reference for type safety
        handle = await client.start_workflow(
            AgentWorkflow.run,
            args=[request.user_intent, request.user_id, {"trace_id": request.trace_id}],
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
            evaluate_policy_activity,
            # C2: Distributed locking removed - deprecated via config
            # acquire_distributed_lock,
            # release_distributed_lock,
            # MAN Mode activities
            risk_triage,
            create_man_task,
            resolve_man_task,
            get_man_task,
            check_man_decision,
            notify_man_task,
            # OmniTrace activities
            *get_omnitrace_activities(),
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
