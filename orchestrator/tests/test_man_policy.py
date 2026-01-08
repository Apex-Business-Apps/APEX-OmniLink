"""
Unit tests for MAN Mode policy engine and models.

Tests the deterministic triage logic, risk assessment, and policy evaluation.
"""

import pytest
from models.man_mode import (
    ActionIntent,
    ManDecision,
    ManLane,
    ManPolicy,
    ManPolicyEngine,
    RiskTriageResult,
)


class TestManLane:
    """Test ManLane enum."""

    def test_lane_values(self):
        """Test lane enum values."""
        assert ManLane.GREEN == "GREEN"
        assert ManLane.YELLOW == "YELLOW"
        assert ManLane.RED == "RED"
        assert ManLane.BLOCKED == "BLOCKED"


class TestActionIntent:
    """Test ActionIntent model."""

    def test_basic_creation(self):
        """Test basic intent creation."""
        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="send_email",
            tool_params={"to": "test@example.com", "subject": "Test"},
        )
        assert intent.tenant_id == "tenant1"
        assert intent.tool_name == "send_email"

    def test_redact_sensitive_params(self):
        """Test sensitive parameter redaction."""
        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="api_call",
            tool_params={
                "url": "https://api.example.com",
                "api_key": "secret123",
                "password": "pass123",
                "normal_param": "value",
            },
        )

        assert intent.tool_params["api_key"] == "[REDACTED]"
        assert intent.tool_params["password"] == "[REDACTED]"
        assert intent.tool_params["normal_param"] == "value"


class TestManPolicyEngine:
    """Test the policy engine triage logic."""

    def test_low_risk_green(self):
        """Test low risk actions are GREEN."""
        policy = ManPolicy()
        engine = ManPolicyEngine(policy)

        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="search_database",
            tool_params={"table": "users", "filters": {"id": "123"}},
        )

        result = engine.triage_intent(intent)

        assert result.lane == ManLane.GREEN
        assert result.risk_score < 0.5

    def test_sensitive_data_red(self):
        """Test sensitive data flag makes RED."""
        policy = ManPolicy()
        engine = ManPolicyEngine(policy)

        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="search_database",
            tool_params={"table": "users", "filters": {"id": "123"}},
            flags={"contains_sensitive_data": True},
        )

        result = engine.triage_intent(intent)

        assert result.lane == ManLane.RED
        assert result.risk_score >= 0.8
        assert "contains_sensitive_data: 0.90" in result.reasons

    def test_affects_rights_red(self):
        """Test affects_rights flag makes RED."""
        policy = ManPolicy()
        engine = ManPolicyEngine(policy)

        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="update_user",
            tool_params={"user_id": "123", "role": "admin"},
            flags={"affects_rights": True},
        )

        result = engine.triage_intent(intent)

        assert result.lane == ManLane.RED
        assert result.risk_score == 1.0
        assert "affects_rights: 1.00" in result.reasons

    def test_irreversible_red(self):
        """Test irreversible actions are RED."""
        policy = ManPolicy()
        engine = ManPolicyEngine(policy)

        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="delete_user",
            tool_params={"user_id": "123"},
            flags={"irreversible": True},
        )

        result = engine.triage_intent(intent)

        assert result.lane == ManLane.RED
        assert result.risk_score >= 0.8
        assert "irreversible: 0.80" in result.reasons

    def test_subjective_language_red(self):
        """Test subjective language patterns make RED."""
        policy = ManPolicy()
        engine = ManPolicyEngine(policy)

        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="send_notification",
            tool_params={"message": "This is a critical emergency vulnerability"},
        )

        result = engine.triage_intent(intent)

        assert result.lane == ManLane.RED
        assert result.risk_score >= 0.8
        assert "subjective_language" in " ".join(result.reasons)

    def test_missing_fields_uncertainty(self):
        """Test missing fields increase uncertainty."""
        policy = ManPolicy()
        engine = ManPolicyEngine(policy)

        # Missing step_id and empty params
        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id=None,
            tool_name="generic_tool",
            tool_params={},
        )

        result = engine.triage_intent(intent)

        assert result.lane in [ManLane.YELLOW, ManLane.RED]
        assert "missing_fields" in " ".join(result.reasons)

    def test_tool_minimum_lane_escalation(self):
        """Test tool minimum lanes escalate risk."""
        policy = ManPolicy(tool_minimum_lanes={"send_email": ManLane.RED})
        engine = ManPolicyEngine(policy)

        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="send_email",
            tool_params={"to": "test@example.com", "subject": "Test"},
        )

        result = engine.triage_intent(intent)

        assert result.lane == ManLane.RED
        assert "send_email requires minimum RED" in " ".join(result.reasons)

    def test_hard_triggers_red(self):
        """Test hard triggers force RED."""
        policy = ManPolicy(
            hard_triggers={
                "tools": ["delete_user"],
                "params": {"amount": ["1000000"]},
                "workflows": ["finance_workflow"],
            }
        )
        engine = ManPolicyEngine(policy)

        # Tool trigger
        intent1 = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="delete_user",
            tool_params={"user_id": "123"},
        )

        result1 = engine.triage_intent(intent1, workflow_key="some_workflow")
        assert result1.lane == ManLane.RED
        assert "Hard trigger activated" in result1.reasons

        # Parameter trigger
        intent2 = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="transfer_money",
            tool_params={"amount": "1000000", "to": "user123"},
        )

        result2 = engine.triage_intent(intent2, workflow_key="some_workflow")
        assert result2.lane == ManLane.RED
        assert "Hard trigger activated" in result2.reasons

    def test_workflow_overrides(self):
        """Test per-workflow policy overrides."""
        policy = ManPolicy(
            global_thresholds={"red": 0.8, "yellow": 0.5},
            per_workflow_overrides={
                "critical_workflow": {
                    "thresholds": {"red": 0.3, "yellow": 0.1},
                    "tool_minimum_lanes": {"send_email": ManLane.YELLOW},
                }
            },
        )
        engine = ManPolicyEngine(policy)

        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="send_email",
            tool_params={"to": "test@example.com", "subject": "Test"},
            flags={"irreversible": True},  # This would normally be RED (0.8)
        )

        # Without workflow override - should be RED
        result_normal = engine.triage_intent(intent, workflow_key="normal_workflow")
        assert result_normal.lane == ManLane.RED

        # With workflow override - lower thresholds make it YELLOW
        result_override = engine.triage_intent(intent, workflow_key="critical_workflow")
        assert result_override.lane == ManLane.YELLOW

    def test_deterministic_behavior(self):
        """Test that triage is deterministic for same inputs."""
        policy = ManPolicy()
        engine = ManPolicyEngine(policy)

        intent = ActionIntent(
            tenant_id="tenant1",
            workflow_id="wf1",
            run_id="run1",
            step_id="step1",
            tool_name="send_email",
            tool_params={"to": "test@example.com", "subject": "Test"},
        )

        # Run multiple times
        results = [engine.triage_intent(intent) for _ in range(5)]

        # All should be identical
        for result in results[1:]:
            assert result.lane == results[0].lane
            assert result.risk_score == results[0].risk_score
            assert result.reasons == results[0].reasons


class TestManPolicy:
    """Test ManPolicy configuration."""

    def test_default_policy(self):
        """Test default policy values."""
        policy = ManPolicy()

        assert policy.global_thresholds["red"] == 0.8
        assert policy.global_thresholds["yellow"] == 0.5
        assert policy.max_pending_per_tenant == 50
        assert policy.task_ttl_minutes == 1440
        assert policy.degrade_behavior == "BLOCK_NEW"

    def test_invalid_degrade_behavior(self):
        """Test invalid degrade behavior raises error."""
        with pytest.raises(ValueError):
            ManPolicy(degrade_behavior="INVALID")

    def test_get_effective_thresholds(self):
        """Test effective thresholds with overrides."""
        policy = ManPolicy(
            global_thresholds={"red": 0.8, "yellow": 0.5},
            per_workflow_overrides={"special": {"thresholds": {"red": 0.3}}},
        )

        # Global
        global_thresh = policy.get_effective_thresholds()
        assert global_thresh["red"] == 0.8

        # Override
        special_thresh = policy.get_effective_thresholds("special")
        assert special_thresh["red"] == 0.3

    def test_get_minimum_lane(self):
        """Test minimum lane lookup."""
        policy = ManPolicy(
            tool_minimum_lanes={"email": ManLane.YELLOW},
            per_workflow_overrides={"special": {"tool_minimum_lanes": {"email": ManLane.RED}}},
        )

        # Global
        assert policy.get_minimum_lane("email") == ManLane.YELLOW

        # Override
        assert policy.get_minimum_lane("email", "special") == ManLane.RED

        # Not found
        assert policy.get_minimum_lane("unknown") is None


class TestRiskTriageResult:
    """Test RiskTriageResult model."""

    def test_valid_risk_score(self):
        """Test valid risk score range."""
        result = RiskTriageResult(lane=ManLane.GREEN, risk_score=0.5, reasons=["test"])
        assert result.risk_score == 0.5

    def test_invalid_risk_score(self):
        """Test invalid risk score raises error."""
        with pytest.raises(ValueError):
            RiskTriageResult(lane=ManLane.GREEN, risk_score=1.5, reasons=["test"])

        with pytest.raises(ValueError):
            RiskTriageResult(lane=ManLane.GREEN, risk_score=-0.1, reasons=["test"])


class TestManDecision:
    """Test ManDecision enum."""

    def test_decision_values(self):
        """Test decision enum values."""
        assert ManDecision.APPROVE == "APPROVE"
        assert ManDecision.DENY == "DENY"
        assert ManDecision.MODIFY == "MODIFY"
        assert ManDecision.CANCEL_WORKFLOW == "CANCEL_WORKFLOW"
