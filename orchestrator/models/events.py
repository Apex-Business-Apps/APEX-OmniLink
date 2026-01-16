"""
Event Schema Definitions - Canonical Data Model (CDM).

Matches sim/contracts.ts EventEnvelope structure for seamless TypeScript ↔ Python interop.

Design Principles:
1. All events are immutable (frozen=True after validation)
2. All timestamps are ISO 8601 strings (not datetime objects) for JSON compatibility
3. All IDs are strings (UUIDs formatted as strings)
4. Strict validation with no implicit coercion
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

# ============================================================================
# ENUMS (Matching TypeScript Union Types)
# ============================================================================


class AppName(str, Enum):
    """12 APEX Apps - matches sim/contracts.ts AppName exactly."""

    OMNILINK = "omnilink"  # Event fabric / integration SDK
    OMNIHUB = "omnihub"  # Dashboard / orchestration UI
    TRADELINE247 = "tradeline247"  # AI receptionist
    AUTOREPAI = "autorepai"  # Auto repair AI
    FLOWBILLS = "flowbills"  # Billing automation
    FLOWC = "flowc"  # Silent compliance
    ASPIRAL = "aspiral"  # aSpiral (stub)
    JUBEELOVE = "jubeelove"  # AI relationship coach
    TRUTALK = "trutalk"  # TRU Talk (stub)
    KEEPSAFE = "keepsafe"  # Safety & compliance
    BRIGHT = "bright"  # Bright Beginnings (stub)
    CARECONNECT = "careconnect"  # CareConnect (stub)


class EventType(str, Enum):
    """Canonical event taxonomy - subset for orchestrator-specific events."""

    # Orchestrator-specific events (not in original contracts.ts)
    ORCHESTRATOR_GOAL_RECEIVED = "orchestrator:agent.goal_received"
    ORCHESTRATOR_PLAN_GENERATED = "orchestrator:agent.plan_generated"
    ORCHESTRATOR_TOOL_CALL_REQUESTED = "orchestrator:agent.tool_call_requested"
    ORCHESTRATOR_TOOL_RESULT_RECEIVED = "orchestrator:agent.tool_result_received"
    ORCHESTRATOR_WORKFLOW_COMPLETED = "orchestrator:workflow.completed"
    ORCHESTRATOR_WORKFLOW_FAILED = "orchestrator:workflow.failed"

    # OmniLink events (from contracts.ts)
    OMNILINK_SYSTEM_STARTED = "omnilink:system.started"
    OMNILINK_HEALTH_CHECK = "omnilink:system.health_check"
    OMNILINK_INTEGRATION_CONNECTED = "omnilink:integration.connected"
    OMNILINK_INTEGRATION_DISCONNECTED = "omnilink:integration.disconnected"
    OMNILINK_EVENT_ROUTED = "omnilink:event.routed"
    OMNILINK_EVENT_FAILED = "omnilink:event.failed"


class SimulatedFailureType(str, Enum):
    """Chaos engineering failure types."""

    TIMEOUT = "timeout"
    NETWORK = "network"
    SERVER = "server"
    VALIDATION = "validation"


# ============================================================================
# TRACE & CHAOS METADATA (Observability)
# ============================================================================


class TraceContext(BaseModel):
    """
    Distributed tracing context for observability.

    Compatible with OpenTelemetry trace propagation format.
    """

    trace_id: str = Field(..., description="Trace ID (same as correlationId)")
    span_id: str = Field(..., description="Span ID (unique per hop)")
    parent_span_id: str | None = Field(None, description="Parent span ID (null for root)")
    baggage: dict[str, str] | None = Field(None, description="Context propagation baggage")

    model_config = {"frozen": True}


class ChaosMetadata(BaseModel):
    """
    Chaos engineering metadata for deterministic testing.

    Used by sim/chaos-engine.ts for reproducible failure injection.
    """

    is_duplicate: bool | None = Field(None, description="Event duplicated by chaos engine")
    injected_delay_ms: int | None = Field(None, description="Injected delay in milliseconds")
    out_of_order: bool | None = Field(None, description="Delivery order scrambled")
    simulated_failure: SimulatedFailureType | None = Field(
        None, description="Simulated failure type"
    )
    retry_attempt: int | None = Field(None, description="Retry attempt number")

    model_config = {"frozen": True}


# ============================================================================
# EVENT ENVELOPE (Core Protocol)
# ============================================================================


class EventEnvelope(BaseModel):
    """
    Universal event envelope - matches sim/contracts.ts EventEnvelope<T>.

    This is the wire format for ALL events crossing TypeScript ↔ Python boundary.

    NON-NEGOTIABLES:
    - All events MUST include correlationId + idempotencyKey
    - All events MUST be JSON-serializable
    - All contracts MUST be versioned
    - All operations MUST be idempotent
    """

    event_id: str = Field(
        default_factory=lambda: str(uuid4()), description="Unique event identifier"
    )
    correlation_id: str = Field(..., description="Correlation ID for cross-app tracing")
    idempotency_key: str = Field(
        ..., description="Idempotency key: {tenantId}-{eventType}-{timestamp}-{nonce}"
    )
    tenant_id: str = Field(..., description="Tenant ID for multi-tenancy isolation")
    event_type: EventType = Field(..., description="Event type: {app}:{domain}.{action}")
    payload: dict[str, Any] = Field(..., description="Event payload (app-specific)")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        description="ISO 8601 timestamp",
    )
    source: AppName = Field(..., description="Source app that emitted the event")
    target: AppName | list[AppName] | None = Field(
        None, description="Target app(s) - null = broadcast"
    )
    trace: TraceContext = Field(..., description="Trace context for observability")
    chaos: ChaosMetadata | None = Field(None, description="Chaos engineering metadata")
    schema_version: str = Field(default="1.0.0", description="Schema version")

    @field_validator("timestamp")
    @classmethod
    def validate_iso8601(cls, v: str) -> str:
        """Ensure timestamp is valid ISO 8601."""
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError as e:
            raise ValueError(f"Invalid ISO 8601 timestamp: {v}") from e
        return v

    @field_validator("idempotency_key")
    @classmethod
    def validate_idempotency_key_format(cls, v: str) -> str:
        """
        Validate idempotency key format: {tenantId}-{eventType}-{timestamp}-{nonce}.

        Relaxed validation - just ensure it's non-empty and has reasonable length.
        """
        if not v or len(v) < 10:
            raise ValueError("Idempotency key too short")
        return v

    model_config = {"frozen": True}


# ============================================================================
# AGENT EVENTS (Event Sourcing for Workflow State)
# ============================================================================


class AgentEvent(BaseModel):
    """
    Base class for all agent workflow events (Event Sourcing pattern).

    Workflow state is reconstructed by replaying a sequence of AgentEvents.
    This ensures deterministic replay in Temporal.io workflows.

    Why Event Sourcing:
    - Complete audit trail of all workflow decisions
    - Deterministic replay for Temporal.io workflows
    - Time-travel debugging (replay to any point)
    - Easy to add new event types without breaking existing workflows
    """

    event_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    correlation_id: str = Field(..., description="Links all events in a workflow instance")

    model_config = {"frozen": True}


class GoalReceived(AgentEvent):
    """
    User submits a goal to the agent (workflow start event).

    Example: "Book a flight to Paris tomorrow and reserve a hotel near the Eiffel Tower"
    """

    goal: str = Field(..., description="User's goal in natural language")
    user_id: str = Field(..., description="User ID who submitted the goal")
    context: dict[str, Any] | None = Field(
        None, description="Additional context (user prefs, history)"
    )


class PlanGenerated(AgentEvent):
    """
    Planner generates an execution plan (DAG of steps).

    Plan can come from:
    1. Semantic cache hit (plan template with injected parameters)
    2. Fresh LLM generation
    """

    plan_id: str = Field(..., description="Unique plan identifier")
    steps: list[dict[str, Any]] = Field(..., description="Execution steps (DAG nodes)")
    cache_hit: bool = Field(..., description="True if plan came from semantic cache")
    template_id: str | None = Field(None, description="Plan template ID (if cache hit)")
    estimated_duration_seconds: int | None = Field(None, description="Estimated execution time")


class ToolCallRequested(AgentEvent):
    """
    Agent requests tool execution (activity invocation).

    This event triggers a Temporal Activity that executes the tool
    with automatic retries and timeout enforcement.
    """

    tool_name: str = Field(..., description="Tool to execute")
    tool_input: dict[str, Any] = Field(..., description="Tool input parameters (validated)")
    step_id: str = Field(..., description="Step ID from plan")
    compensation_activity: str | None = Field(
        None, description="Compensation activity name (for Saga pattern)"
    )


class ToolResultReceived(AgentEvent):
    """
    Tool execution completed (activity result).

    Contains either success result or error details for retry/compensation logic.
    """

    tool_name: str = Field(..., description="Tool that was executed")
    step_id: str = Field(..., description="Step ID from plan")
    success: bool = Field(..., description="True if tool execution succeeded")
    result: dict[str, Any] | None = Field(None, description="Tool output (if success)")
    error: str | None = Field(None, description="Error message (if failure)")
    retry_count: int = Field(default=0, description="Number of retries attempted")


class WorkflowCompleted(AgentEvent):
    """
    Workflow completed successfully (all steps executed).

    This is the terminal success state.
    """

    plan_id: str = Field(..., description="Completed plan ID")
    total_steps: int = Field(..., description="Total number of steps executed")
    duration_seconds: float = Field(..., description="Total workflow duration")
    final_result: dict[str, Any] = Field(..., description="Final workflow output")


class WorkflowFailed(AgentEvent):
    """
    Workflow failed after exhausting retries (terminal failure state).

    Includes compensation details if Saga rollback was triggered.
    """

    plan_id: str = Field(..., description="Failed plan ID")
    failed_step_id: str = Field(..., description="Step that caused failure")
    error_message: str = Field(..., description="Error details")
    compensation_executed: bool = Field(..., description="True if Saga compensations were executed")
    compensation_results: list[dict[str, Any]] | None = Field(
        None, description="Results of compensation activities"
    )


# ============================================================================
# SCHEMA TRANSLATOR PROTOCOL
# ============================================================================


class SchemaTranslator:
    """
    Protocol for transforming raw tool outputs into Pydantic models.

    Why this exists:
    - External tools return arbitrary dict structures
    - We need type-safe, validated Pydantic models
    - Dynamic validation with context-aware error handling
    - Supports custom transformers per tool type

    Usage:
        translator = SchemaTranslator()
        validated = translator.translate(raw_dict, TargetModel)
    """

    @staticmethod
    def translate(
        raw_data: dict[str, Any],
        target_model: type[BaseModel],
        strict: bool = True,
        context: dict[str, Any] | None = None,
    ) -> BaseModel:
        """
        Transform raw dict into validated Pydantic model.

        Args:
            raw_data: Raw dictionary from tool output
            target_model: Target Pydantic model class
            strict: If True, fail on extra fields. If False, ignore them.
            context: Additional context for validation (e.g., user_id, tenant_id)

        Returns:
            Validated Pydantic model instance

        Raises:
            ValidationError: If raw_data doesn't match target schema

        Example:
            >>> raw = {"goal": "Book flight", "user_id": "u123"}
            >>> goal = SchemaTranslator.translate(raw, GoalReceived)
            >>> assert goal.goal == "Book flight"
        """
        # Create validation context
        validation_context = context or {}

        # Use Pydantic's model_validate with strict mode
        return target_model.model_validate(
            raw_data,
            strict=strict,
            context=validation_context,
        )

    @staticmethod
    def batch_translate(
        raw_data_list: list[dict[str, Any]],
        target_model: type[BaseModel],
        strict: bool = True,
    ) -> list[BaseModel]:
        """
        Transform list of raw dicts into validated Pydantic models.

        Useful for bulk tool outputs (e.g., search results, batch API responses).
        """
        return [SchemaTranslator.translate(raw, target_model, strict) for raw in raw_data_list]
