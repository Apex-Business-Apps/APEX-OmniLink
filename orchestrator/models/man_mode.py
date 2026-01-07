"""
MAN Mode Data Models and Policy Engine.

This module defines the universal triage and policy models for Manual Assistance Needed (MAN) Mode,
providing human override capabilities for subjective/sensitive/high-risk workflow decisions.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class ManLane(str, Enum):
    """Risk assessment lanes for workflow steps."""

    GREEN = "GREEN"  # Execute normally
    YELLOW = "YELLOW"  # Execute with caution (optional escalation)
    RED = "RED"  # Require human approval before execution
    BLOCKED = "BLOCKED"  # Never execute (policy violation)


class ActionIntent(BaseModel):
    """
    Structured representation of a tool execution intent.

    Captures all context needed for risk assessment and audit logging.
    """

    tenant_id: str = Field(..., description="Tenant identifier")
    workflow_id: str = Field(..., description="Workflow instance ID")
    run_id: str = Field(..., description="Workflow run identifier")
    step_id: str = Field(..., description="Step identifier within workflow")
    tool_name: str = Field(..., description="Name of the tool being executed")
    tool_params: Dict[str, Any] = Field(default_factory=dict, description="Tool parameters")
    flags: Dict[str, Any] = Field(default_factory=dict, description="Additional flags and metadata")

    @field_validator("tool_params")
    @classmethod
    def redact_sensitive_params(cls, v):
        """Redact sensitive parameters for audit logging."""
        # Redact common sensitive fields
        sensitive_keys = {"password", "token", "secret", "key", "api_key", "auth"}
        redacted = {}

        for key, value in v.items():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = value

        return redacted


class RiskTriageResult(BaseModel):
    """
    Result of risk assessment for an action intent.

    Determines whether human intervention is required.
    """

    lane: ManLane = Field(..., description="Risk assessment lane")
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Risk score (0.0=safe, 1.0=maximum risk)"
    )
    reasons: List[str] = Field(default_factory=list, description="Reasons for the risk assessment")


class ManDecision(str, Enum):
    """Possible decisions on a MAN task."""

    APPROVE = "APPROVE"  # Allow execution
    DENY = "DENY"  # Block execution
    MODIFY = "MODIFY"  # Allow with modified parameters
    CANCEL_WORKFLOW = "CANCEL_WORKFLOW"  # Cancel entire workflow


class ManTask(BaseModel):
    """
    A pending manual approval task.

    Represents a workflow step that requires human decision before proceeding.
    """

    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique task identifier")
    tenant_id: str = Field(..., description="Tenant identifier")
    workflow_id: str = Field(..., description="Workflow instance ID")
    run_id: Optional[str] = Field(None, description="Workflow run identifier")
    step_id: Optional[str] = Field(None, description="Step identifier within workflow")
    tool_name: str = Field(..., description="Name of the tool requiring approval")
    idempotency_key: str = Field(..., description="Idempotency key to prevent duplicates")

    status: str = Field(default="PENDING", description="Task status")
    risk_score: float = Field(..., description="Risk score from triage")
    risk_reasons: List[str] = Field(
        default_factory=list,
        description="Reasons for requiring approval"
    )

    intent: Dict[str, Any] = Field(
        default_factory=dict,
        description="Original action intent (redacted)"
    )

    reviewer_id: Optional[str] = Field(None, description="ID of the reviewer who decided")
    decision: Optional[Dict[str, Any]] = Field(None, description="Decision details")

    created_at: str = Field(default_factory=lambda: "now()", description="Creation timestamp")
    updated_at: str = Field(default_factory=lambda: "now()", description="Last update timestamp")


class ManDecisionPayload(BaseModel):
    """
    Payload for submitting a decision on a MAN task.
    """

    decision: ManDecision = Field(..., description="The decision")
    reason: str = Field(..., description="Reason for the decision")
    reviewer_id: str = Field(..., description="ID of the reviewer")
    modified_params: Optional[Dict[str, Any]] = Field(
        None,
        description="Modified parameters (for MODIFY decision)"
    )


class ManPolicy(BaseModel):
    """
    Policy configuration for MAN Mode.

    Defines risk thresholds, triggers, and behavior per tenant/workflow.
    """

    # Universal risk dimensions
    global_thresholds: Dict[str, float] = Field(
        default_factory=lambda: {"red": 0.8, "yellow": 0.5},
        description="Global risk score thresholds",
    )

    tool_minimum_lanes: Dict[str, ManLane] = Field(
        default_factory=dict, description="Minimum lane per tool name"
    )

    hard_triggers: Dict[str, Any] = Field(
        default_factory=dict, description="Hard triggers that force specific lanes"
    )

    # Per-workflow overrides
    per_workflow_overrides: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="Workflow-specific policy overrides"
    )

    # Operational controls
    max_pending_per_tenant: int = Field(default=50, description="Maximum pending tasks per tenant")

    task_ttl_minutes: int = Field(
        default=1440,  # 24 hours
        description="Task time-to-live in minutes",
    )

    degrade_behavior: str = Field(
        default="BLOCK_NEW", description="Behavior when backlog exceeds limit"
    )

    @field_validator("degrade_behavior")
    @classmethod
    def validate_degrade_behavior(cls, v):
        """Validate degrade behavior options."""
        allowed = {"BLOCK_NEW", "FORCE_PAUSE", "AUTO_DENY"}
        if v not in allowed:
            raise ValueError(f"degrade_behavior must be one of {allowed}")
        return v

    def get_effective_thresholds(self, workflow_key: Optional[str] = None) -> Dict[str, float]:
        """Get effective thresholds for a workflow."""
        base = self.global_thresholds.copy()

        if workflow_key and workflow_key in self.per_workflow_overrides:
            override = self.per_workflow_overrides[workflow_key]
            base.update(override.get("thresholds", {}))

        return base

    def get_minimum_lane(
        self,
        tool_name: str,
        workflow_key: Optional[str] = None
    ) -> Optional[ManLane]:
        """Get minimum required lane for a tool."""
        # Check workflow-specific override first
        if workflow_key and workflow_key in self.per_workflow_overrides:
            override = self.per_workflow_overrides[workflow_key]
            tool_lanes = override.get("tool_minimum_lanes", {})
            if tool_name in tool_lanes:
                return ManLane(tool_lanes[tool_name])

        # Fall back to global
        if tool_name in self.tool_minimum_lanes:
            return ManLane(self.tool_minimum_lanes[tool_name])

        return None


class ManPolicyEngine:
    """
    Deterministic risk triage engine for MAN Mode.

    Evaluates action intents against policy to determine required oversight level.
    """

    def __init__(self, policy: ManPolicy):
        self.policy = policy

    def triage_intent(
        self,
        intent: ActionIntent,
        workflow_key: Optional[str] = None,
        free_text_signals: Optional[List[str]] = None,
    ) -> RiskTriageResult:
        """
        Triage an action intent for risk level.

        This function must be deterministic given the same inputs.
        """
        reasons = []
        risk_score = 0.0

        # 1. Check hard triggers (always RED)
        if self._check_hard_triggers(intent, workflow_key):
            reasons.append("Hard trigger activated")
            return RiskTriageResult(lane=ManLane.RED, risk_score=1.0, reasons=reasons)

        # 2. Evaluate risk dimensions
        dimensions = self._evaluate_risk_dimensions(intent, free_text_signals or [])
        risk_score = max(dimensions.values()) if dimensions else 0.0
        reasons.extend([f"{k}: {v:.2f}" for k, v in dimensions.items() if v > 0])

        # 3. Apply tool minimum lanes
        min_lane = self.policy.get_minimum_lane(intent.tool_name, workflow_key)
        if min_lane:
            reasons.append(f"Tool {intent.tool_name} requires minimum {min_lane}")
            if min_lane == ManLane.RED:
                return RiskTriageResult(
                    lane=ManLane.RED, risk_score=max(risk_score, 0.8), reasons=reasons
                )
            elif min_lane == ManLane.YELLOW and risk_score < 0.5:
                risk_score = 0.5

        # 4. Apply thresholds
        thresholds = self.policy.get_effective_thresholds(workflow_key)

        if risk_score >= thresholds.get("red", 0.8):
            lane = ManLane.RED
        elif risk_score >= thresholds.get("yellow", 0.5):
            lane = ManLane.YELLOW
        else:
            lane = ManLane.GREEN

        return RiskTriageResult(lane=lane, risk_score=risk_score, reasons=reasons)

    def _check_hard_triggers(self, intent: ActionIntent, workflow_key: Optional[str]) -> bool:
        """Check if any hard triggers are activated."""
        triggers = self.policy.hard_triggers

        # Check tool-specific triggers
        tool_triggers = triggers.get("tools", {})
        if intent.tool_name in tool_triggers:
            return True

        # Check parameter-based triggers
        param_triggers = triggers.get("params", {})
        for param_key, trigger_values in param_triggers.items():
            if param_key in intent.tool_params:
                param_value = str(intent.tool_params[param_key]).lower()
                if any(trigger.lower() in param_value for trigger in trigger_values):
                    return True

        # Check workflow-specific triggers
        if workflow_key:
            workflow_triggers = triggers.get("workflows", {})
            if workflow_key in workflow_triggers:
                return True

        return False

    def _evaluate_risk_dimensions(
        self, intent: ActionIntent, free_text_signals: List[str]
    ) -> Dict[str, float]:
        """
        Evaluate universal risk dimensions.

        Returns a dict of dimension_name -> risk_score (0.0-1.0)
        """
        dimensions = {}

        # Impact: affects_rights
        if intent.flags.get("affects_rights", False):
            dimensions["affects_rights"] = 1.0

        # Sensitivity: contains_sensitive_data
        if intent.flags.get("contains_sensitive_data", False):
            dimensions["contains_sensitive_data"] = 0.9

        # Reversibility: irreversible
        if intent.flags.get("irreversible", False):
            dimensions["irreversible"] = 0.8

        # Subjectivity: exception/vulnerability language patterns
        text_to_check = free_text_signals + [str(v) for v in intent.tool_params.values()]
        subjective_patterns = [
            "exception",
            "vulnerability",
            "risk",
            "danger",
            "warning",
            "critical",
            "emergency",
            "urgent",
            "suspicious",
            "anomaly",
        ]

        text_combined = " ".join(text_to_check).lower()
        subjectivity_score = sum(1 for pattern in subjective_patterns if pattern in text_combined)
        if subjectivity_score > 0:
            dimensions["subjective_language"] = min(subjectivity_score * 0.2, 1.0)

        # Uncertainty: missing required fields
        uncertainty_score = 0.0
        if not intent.tool_params:
            uncertainty_score += 0.3
        if not intent.step_id:
            uncertainty_score += 0.2
        if uncertainty_score > 0:
            dimensions["missing_fields"] = uncertainty_score

        return dimensions


# Default policy for bootstrapping
DEFAULT_MAN_POLICY = ManPolicy()

# Global policy engine instance (initialized with default policy)
_policy_engine = ManPolicyEngine(DEFAULT_MAN_POLICY)

# Policy cache for performance
_policy_cache: Dict[str, Dict[str, Any]] = {}
_POLICY_CACHE_TTL_SECONDS = 30  # 30 second cache


def get_policy_engine(policy: Optional[ManPolicy] = None) -> ManPolicyEngine:
    """Get the global policy engine instance."""
    global _policy_engine
    if policy:
        _policy_engine = ManPolicyEngine(policy)
    return _policy_engine


def get_cached_policy(
    tenant_id: Optional[str],
    workflow_key: Optional[str]
) -> Optional[Dict[str, Any]]:
    """
    Get cached policy for tenant/workflow combination.

    Returns cached policy if available and not expired, None otherwise.
    """
    import time

    cache_key = f"{tenant_id or 'global'}:{workflow_key or 'default'}"

    if cache_key in _policy_cache:
        cached_entry = _policy_cache[cache_key]
        if time.time() - cached_entry["timestamp"] < _POLICY_CACHE_TTL_SECONDS:
            return cached_entry["policy"]
        else:
            # Expired, remove from cache
            del _policy_cache[cache_key]

    return None


def set_cached_policy(
    tenant_id: Optional[str],
    workflow_key: Optional[str],
    policy: Dict[str, Any]
) -> None:
    """
    Cache policy for tenant/workflow combination.
    """
    import time

    cache_key = f"{tenant_id or 'global'}:{workflow_key or 'default'}"
    _policy_cache[cache_key] = {"policy": policy, "timestamp": time.time()}


async def load_policy_with_cache(
    tenant_id: Optional[str],
    workflow_key: Optional[str]
) -> ManPolicy:
    """
    Load policy with caching for performance.

    Checks cache first, then database if needed.
    """
    # Check cache first
    cached_policy = get_cached_policy(tenant_id, workflow_key)
    if cached_policy:
        return ManPolicy(**cached_policy)

    # Load from database
    from providers.database.factory import get_database_provider

    db = get_database_provider()

    # Try specific policy first (workflow > tenant > global)
    policies_to_try = [
        {"tenant_id": tenant_id, "workflow_key": workflow_key},  # Specific
        {"tenant_id": tenant_id, "workflow_key": None},  # Tenant-wide
        {"tenant_id": None, "workflow_key": None},  # Global
    ]

    for policy_filters in policies_to_try:
        policy_record = await db.select_one(
            table="man_policies", filters={k: v for k, v in policy_filters.items() if v is not None}
        )

        if policy_record:
            policy_data = policy_record["policy_json"]
            # Cache the policy
            set_cached_policy(tenant_id, workflow_key, policy_data)
            return ManPolicy(**policy_data)

    # Fallback to default policy
    default_policy = DEFAULT_MAN_POLICY
    set_cached_policy(tenant_id, workflow_key, default_policy.model_dump())
    return default_policy


# Overload protection utilities
async def check_tenant_overload(tenant_id: str) -> Dict[str, Any]:
    """
    Check if tenant is overloaded and what action to take.

    Returns:
        {
            "overloaded": bool,
            "pending_count": int,
            "action": str or None,
            "max_pending": int
        }
    """
    # Load tenant policy
    policy = await load_policy_with_cache(tenant_id, None)
    max_pending = policy.max_pending_per_tenant

    # Count pending tasks
    from providers.database.factory import get_database_provider

    db = get_database_provider()

    pending_tasks = await db.select(
        table="man_tasks", filters={"tenant_id": tenant_id, "status": "PENDING"}
    )

    pending_count = len(pending_tasks)
    overloaded = pending_count >= max_pending

    return {
        "overloaded": overloaded,
        "pending_count": pending_count,
        "max_pending": max_pending,
        "action": policy.degrade_behavior if overloaded else None,
    }


async def cleanup_expired_tasks() -> int:
    """
    Clean up expired MAN tasks.

    Returns number of tasks expired.
    """
    import time

    # Get database provider
    from providers.database.factory import get_database_provider

    db = get_database_provider()

    # Load all policies to check TTL settings
    policies = await db.select(table="man_policies")
    tenant_ttls = {}

    # Build tenant -> TTL mapping
    for policy_record in policies:
        tenant_id = policy_record["tenant_id"]
        policy_data = policy_record["policy_json"]
        ttl_minutes = policy_data.get("task_ttl_minutes", 1440)  # Default 24 hours
        tenant_ttls[tenant_id] = ttl_minutes

    # Default TTL for tenants without specific policy
    default_ttl = DEFAULT_MAN_POLICY.task_ttl_minutes

    # Find expired tasks
    all_pending_tasks = await db.select(table="man_tasks", filters={"status": "PENDING"})

    expired_tasks = []
    current_time = time.time()

    for task in all_pending_tasks:
        tenant_id = task["tenant_id"]
        ttl_minutes = tenant_ttls.get(tenant_id, default_ttl)
        ttl_seconds = ttl_minutes * 60

        created_timestamp = task["created_at"]
        if isinstance(created_timestamp, str):
            # Assume ISO format, convert to timestamp
            from datetime import datetime

            created_time = datetime.fromisoformat(
                created_timestamp.replace("Z", "+00:00")
            ).timestamp()
        else:
            created_time = created_timestamp

        if current_time - created_time > ttl_seconds:
            expired_tasks.append(task["id"])

    # Mark expired tasks
    expired_count = 0
    for task_id in expired_tasks:
        await db.update(
            table="man_tasks",
            filters={"id": task_id, "status": "PENDING"},
            updates={"status": "EXPIRED"},
        )
        expired_count += 1

    return expired_count
