"""
Data models for Manual Assistance Needed (MAN) mode.

MAN mode provides human-in-the-loop safety for high-risk actions in the
APEX Orchestrator. Actions are triaged by risk level and may require
manual approval before execution.
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class ManLane(Enum):
    """Risk levels for action triage."""

    GREEN = "green"      # Low risk - auto-approve
    YELLOW = "yellow"    # Medium risk - review optional
    RED = "red"          # High risk - manual approval required
    BLOCKED = "blocked"  # Critical risk - always blocked


class ActionIntent(BaseModel):
    """Represents an action that may need manual review."""

    tenant_id: str
    workflow_id: str
    run_id: Optional[str] = None
    step_id: Optional[str] = None
    tool_name: str
    tool_params: Dict[str, Any] = Field(default_factory=dict)
    flags: Dict[str, Any] = Field(default_factory=dict)


class ManTask(BaseModel):
    """A manual review task pending human decision."""

    id: str
    idempotency_key: str
    status: str  # "pending", "approved", "rejected", "expired"
    intent: ActionIntent
    decision: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str


class ManDecision(Enum):
    """Possible decisions for manual review tasks."""

    APPROVE = "APPROVE"
    DENY = "DENY"
    MODIFY = "MODIFY"
    CANCEL_WORKFLOW = "CANCEL_WORKFLOW"


class RiskTriageResult(BaseModel):
    """Result of risk triage for an action intent."""

    lane: ManLane
    risk_score: float = Field(ge=0.0, le=1.0)
    reasons: List[str]

    @field_validator("risk_score")
    @classmethod
    def validate_risk_score(cls, v: float) -> float:
        """Validate risk score is between 0 and 1."""
        if not 0.0 <= v <= 1.0:
            raise ValueError("Risk score must be between 0.0 and 1.0")
        return v


class ManPolicy(BaseModel):
    """Policy configuration for MAN mode risk assessment."""

    global_thresholds: Dict[str, float] = Field(
        default_factory=lambda: {"red": 0.8, "yellow": 0.5}
    )
    tool_minimum_lanes: Dict[str, ManLane] = Field(default_factory=dict)
    hard_triggers: Dict[str, List[str]] = Field(
        default_factory=lambda: {"tools": [], "params": {}, "workflows": []}
    )
    per_workflow_overrides: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    max_pending_per_tenant: int = 50
    task_ttl_minutes: int = 1440  # 24 hours
    degrade_behavior: str = Field(
        default="BLOCK_NEW", pattern="^(BLOCK_NEW|ALLOW_ALL)$"
    )

    def get_effective_thresholds(self, workflow_key: Optional[str] = None) -> Dict[str, float]:
        """Get thresholds for a workflow, with overrides applied."""
        thresholds = self.global_thresholds.copy()
        if workflow_key and workflow_key in self.per_workflow_overrides:
            override = self.per_workflow_overrides[workflow_key]
            if "thresholds" in override:
                thresholds.update(override["thresholds"])
        return thresholds

    def get_minimum_lane(
        self, tool_name: str, workflow_key: Optional[str] = None
    ) -> Optional[ManLane]:
        """Get minimum lane for a tool, with workflow overrides."""
        # Check workflow-specific override first
        if workflow_key and workflow_key in self.per_workflow_overrides:
            override = self.per_workflow_overrides[workflow_key]
            if "tool_minimum_lanes" in override and tool_name in override["tool_minimum_lanes"]:
                return override["tool_minimum_lanes"][tool_name]

        # Fall back to global minimum
        return self.tool_minimum_lanes.get(tool_name)


class ManPolicyEngine:
    """Engine for triaging action intents against policy rules."""

    def __init__(self, policy: ManPolicy):
        self.policy = policy

    def triage_intent(
        self, intent: ActionIntent, workflow_key: Optional[str] = None
    ) -> RiskTriageResult:
        """Triage an action intent and return risk assessment."""
        risk_score = 0.0
        reasons = []

        # Check hard triggers first
        if self._check_hard_triggers(intent, workflow_key):
            return RiskTriageResult(
                lane=ManLane.RED,
                risk_score=1.0,
                reasons=["Hard trigger activated"]
            )

        # Assess risk factors
        risk_score, reasons = self._assess_risk_factors(intent, workflow_key)

        # Apply minimum lane constraints
        min_lane = self.policy.get_minimum_lane(intent.tool_name, workflow_key)
        if min_lane:
            reasons.append(f"{intent.tool_name} requires minimum {min_lane.value}")

        # Determine final lane based on thresholds
        thresholds = self.policy.get_effective_thresholds(workflow_key)
        if risk_score >= thresholds.get("red", 0.8):
            lane = ManLane.RED
        elif risk_score >= thresholds.get("yellow", 0.5):
            lane = ManLane.YELLOW
        else:
            lane = ManLane.GREEN

        # Apply minimum lane override
        if min_lane and self._lane_priority(min_lane) > self._lane_priority(lane):
            lane = min_lane

        return RiskTriageResult(lane=lane, risk_score=risk_score, reasons=reasons)

    def _check_hard_triggers(
        self, intent: ActionIntent, workflow_key: Optional[str] = None
    ) -> bool:
        """Check if intent matches any hard trigger rules."""
        triggers = self.policy.hard_triggers

        # Tool-based triggers
        if intent.tool_name in triggers.get("tools", []):
            return True

        # Workflow-based triggers
        if workflow_key and workflow_key in triggers.get("workflows", []):
            return True

        # Parameter-based triggers
        param_triggers = triggers.get("params", {})
        for param_key, trigger_values in param_triggers.items():
            if param_key in intent.tool_params:
                param_value = str(intent.tool_params[param_key])
                if param_value in trigger_values:
                    return True

        return False

    def _assess_risk_factors(
        self, intent: ActionIntent, workflow_key: Optional[str] = None
    ) -> tuple[float, List[str]]:
        """Assess risk factors and return score and reasons."""
        score = 0.0
        reasons = []

        # Irreversible actions are high risk
        if intent.flags.get("irreversible"):
            score += 0.8
            reasons.append("irreversible: 0.80")

        # Check for sensitive tools
        sensitive_tools = ["delete_record", "update_user", "send_email"]
        if intent.tool_name in sensitive_tools:
            score += 0.6
            reasons.append(f"sensitive_tool_{intent.tool_name}: 0.60")

        # Check for missing required fields (increases uncertainty)
        if not intent.step_id:
            score += 0.3
            reasons.append("missing_step_id: 0.30")

        return min(score, 1.0), reasons

    def _lane_priority(self, lane: ManLane) -> int:
        """Get priority order for lanes (higher = more restrictive)."""
        priorities = {
            ManLane.GREEN: 0,
            ManLane.YELLOW: 1,
            ManLane.RED: 2,
            ManLane.BLOCKED: 3,
        }
        return priorities[lane]
