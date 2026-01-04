"""Unit tests for Pydantic models and schema validation."""

import pytest
from pydantic import ValidationError

from models.events import (
    AppName,
    EventEnvelope,
    EventType,
    GoalReceived,
    PlanGenerated,
    SchemaTranslator,
    ToolCallRequested,
    ToolResultReceived,
    TraceContext,
    WorkflowCompleted,
    WorkflowFailed,
)


class TestEventEnvelope:
    """Test EventEnvelope serialization and validation."""

    def test_create_valid_envelope(self):
        """Should create valid event envelope with all required fields."""
        envelope = EventEnvelope(
            correlation_id="corr-123",
            idempotency_key="tenant-123-event-1-nonce",
            tenant_id="tenant-123",
            event_type=EventType.ORCHESTRATOR_GOAL_RECEIVED,
            payload={"goal": "test"},
            source=AppName.OMNILINK,
            trace=TraceContext(trace_id="trace-123", span_id="span-1"),
        )

        assert envelope.correlation_id == "corr-123"
        assert envelope.event_type == EventType.ORCHESTRATOR_GOAL_RECEIVED
        assert envelope.source == AppName.OMNILINK
        assert envelope.schema_version == "1.0.0"

    def test_invalid_timestamp_rejected(self):
        """Should reject invalid ISO 8601 timestamps."""
        with pytest.raises(ValidationError):
            EventEnvelope(
                correlation_id="corr-123",
                idempotency_key="key-123",
                tenant_id="tenant-123",
                event_type=EventType.ORCHESTRATOR_GOAL_RECEIVED,
                payload={},
                source=AppName.OMNILINK,
                trace=TraceContext(trace_id="trace-123", span_id="span-1"),
                timestamp="not-a-timestamp",
            )

    def test_envelope_immutable(self):
        """Should be immutable after creation (frozen=True)."""
        envelope = EventEnvelope(
            correlation_id="corr-123",
            idempotency_key="tenant-123-event-001-20260104-abc123",  # Valid key format
            tenant_id="tenant-123",
            event_type=EventType.ORCHESTRATOR_GOAL_RECEIVED,
            payload={},
            source=AppName.OMNILINK,
            trace=TraceContext(trace_id="trace-123", span_id="span-1"),
        )

        with pytest.raises(ValidationError):
            envelope.correlation_id = "new-id"  # Should fail


class TestAgentEvents:
    """Test agent event models for Event Sourcing."""

    def test_goal_received_event(self):
        """Should create GoalReceived event."""
        event = GoalReceived(
            correlation_id="corr-123",
            goal="Book flight to Paris",
            user_id="user-456",
        )

        assert event.goal == "Book flight to Paris"
        assert event.user_id == "user-456"
        assert event.event_id is not None

    def test_plan_generated_event(self):
        """Should create PlanGenerated event."""
        event = PlanGenerated(
            correlation_id="corr-123",
            plan_id="plan-789",
            steps=[{"id": "step1", "tool": "search"}],
            cache_hit=True,
            template_id="tmpl-123",
        )

        assert event.plan_id == "plan-789"
        assert event.cache_hit is True
        assert len(event.steps) == 1

    def test_tool_call_requested_event(self):
        """Should create ToolCallRequested event."""
        event = ToolCallRequested(
            correlation_id="corr-123",
            tool_name="search_database",
            tool_input={"table": "profiles"},
            step_id="step1",
            compensation_activity="delete_record",
        )

        assert event.tool_name == "search_database"
        assert event.compensation_activity == "delete_record"

    def test_tool_result_success(self):
        """Should record successful tool execution."""
        event = ToolResultReceived(
            correlation_id="corr-123",
            tool_name="search_database",
            step_id="step1",
            success=True,
            result={"data": [{"id": 1}]},
        )

        assert event.success is True
        assert event.result == {"data": [{"id": 1}]}
        assert event.error is None

    def test_tool_result_failure(self):
        """Should record failed tool execution."""
        event = ToolResultReceived(
            correlation_id="corr-123",
            tool_name="search_database",
            step_id="step1",
            success=False,
            error="Connection timeout",
            retry_count=3,
        )

        assert event.success is False
        assert event.error == "Connection timeout"
        assert event.retry_count == 3

    def test_workflow_completed_event(self):
        """Should create WorkflowCompleted event."""
        event = WorkflowCompleted(
            correlation_id="corr-123",
            plan_id="plan-789",
            total_steps=5,
            duration_seconds=12.5,
            final_result={"status": "success"},
        )

        assert event.total_steps == 5
        assert event.duration_seconds == 12.5

    def test_workflow_failed_event(self):
        """Should create WorkflowFailed event with compensation details."""
        event = WorkflowFailed(
            correlation_id="corr-123",
            plan_id="plan-789",
            failed_step_id="step3",
            error_message="Database connection failed",
            compensation_executed=True,
            compensation_results=[{"step_id": "step2", "success": True}],
        )

        assert event.failed_step_id == "step3"
        assert event.compensation_executed is True
        assert len(event.compensation_results) == 1


class TestSchemaTranslator:
    """Test dynamic schema translation."""

    def test_translate_valid_data(self):
        """Should translate dict to Pydantic model."""
        raw_data = {
            "correlation_id": "corr-123",
            "goal": "Book flight",
            "user_id": "user-456",
        }

        goal = SchemaTranslator.translate(raw_data, GoalReceived)

        assert isinstance(goal, GoalReceived)
        assert goal.goal == "Book flight"
        assert goal.user_id == "user-456"

    def test_translate_invalid_data_strict(self):
        """Should reject invalid data in strict mode."""
        raw_data = {
            "correlation_id": "corr-123",
            "goal": "Book flight",
            # Missing required user_id
        }

        with pytest.raises(ValidationError):
            SchemaTranslator.translate(raw_data, GoalReceived, strict=True)

    def test_batch_translate(self):
        """Should translate list of dicts."""
        raw_data_list = [
            {"correlation_id": "c1", "goal": "Goal 1", "user_id": "u1"},
            {"correlation_id": "c2", "goal": "Goal 2", "user_id": "u2"},
        ]

        goals = SchemaTranslator.batch_translate(raw_data_list, GoalReceived)

        assert len(goals) == 2
        assert all(isinstance(g, GoalReceived) for g in goals)
        assert goals[0].goal == "Goal 1"
        assert goals[1].goal == "Goal 2"


class TestAppNameEnum:
    """Test AppName enum matches TypeScript contracts."""

    def test_all_12_apps_present(self):
        """Should have exactly 12 APEX apps."""
        apps = list(AppName)
        assert len(apps) == 12

    def test_omnilink_value(self):
        """Should match TypeScript value."""
        assert AppName.OMNILINK.value == "omnilink"

    def test_serialization(self):
        """Should serialize to string."""
        assert str(AppName.TRADELINE247) == "AppName.TRADELINE247"
        assert AppName.TRADELINE247.value == "tradeline247"
