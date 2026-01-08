"""
MAN Mode Data Models - Type-safe contracts for human approval safety gate.

MAN = Manual Approval Node. When an agent action is classified as high-risk
(RED lane), execution pauses and a ManTask is created for human review.

Design Principles:
1. All models are immutable (frozen=True)
2. All IDs are strings (UUIDs formatted as strings)
3. Strict validation with Pydantic
4. JSON-serializable for workflow persistence
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

# ============================================================================
# ENUMS
# ============================================================================


class ManLane(str, Enum):
    """
    Risk classification lanes for agent actions.

    GREEN: Auto-execute (safe operations like reads)
    YELLOW: Execute with logging (moderate risk, audit trail)
    RED: Block for human approval (high-risk, irreversible)
    BLOCKED: Never execute (prohibited operations)
    """

    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"
    BLOCKED = "BLOCKED"


class ManTaskStatus(str, Enum):
    """
    Status of a MAN approval task.

    PENDING: Awaiting human decision
    APPROVED: Human approved the action
    DENIED: Human denied the action
    EXPIRED: Task timed out without decision
    """

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    EXPIRED = "EXPIRED"


# ============================================================================
# DATA MODELS
# ============================================================================


class ActionIntent(BaseModel):
    """
    Describes an agent action that requires risk evaluation.

    Captures the tool name, parameters, and context needed for risk triage.
    This is the input to the ManPolicy.triage() method.
    """

    tool_name: str = Field(..., description="Name of the tool to execute")
    params: dict[str, Any] = Field(
        default_factory=dict,
        description="Tool parameters"
    )
    workflow_id: str = Field(..., description="Parent workflow ID")
    step_id: str = Field(default="", description="Step ID within the plan")
    irreversible: bool = Field(
        default=False,
        description="Explicitly marked as irreversible by planner"
    )
    context: Optional[dict[str, Any]] = Field(
        default=None,
        description="Additional context (user_id, resource_id, etc.)"
    )

    model_config = {"frozen": True}


class RiskTriageResult(BaseModel):
    """
    Result of risk classification for an action.

    Returned by ManPolicy.triage() to indicate how the action should be handled.
    """

    lane: ManLane = Field(..., description="Risk classification lane")
    reason: str = Field(..., description="Human-readable reason for classification")
    requires_approval: bool = Field(
        ...,
        description="True if action requires human approval"
    )
    risk_factors: list[str] = Field(
        default_factory=list,
        description="List of factors that contributed to classification"
    )
    suggested_timeout_hours: int = Field(
        default=24,
        description="Suggested timeout for approval task"
    )

    model_config = {"frozen": True}


class ManTaskDecision(BaseModel):
    """
    Human decision on a MAN approval task.

    Captures the approval/denial decision along with metadata.
    """

    status: ManTaskStatus = Field(..., description="Decision status")
    reason: Optional[str] = Field(
        default=None,
        description="Human-provided reason for decision"
    )
    decided_by: str = Field(..., description="User ID who made the decision")
    decided_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z",
        description="ISO 8601 timestamp of decision"
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None,
        description="Additional decision metadata"
    )

    model_config = {"frozen": True}


class ManTask(BaseModel):
    """
    A MAN approval task persisted to the database.

    Created when an agent action is classified as RED lane.
    Workflow pauses until this task is resolved by a human.
    """

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique task identifier"
    )
    idempotency_key: str = Field(
        ...,
        description="Idempotency key: {workflow_id}:{step_id}"
    )
    workflow_id: str = Field(..., description="Parent workflow ID")
    step_id: str = Field(default="", description="Step ID within the plan")
    status: ManTaskStatus = Field(
        default=ManTaskStatus.PENDING,
        description="Current task status"
    )
    intent: ActionIntent = Field(..., description="The action requiring approval")
    triage_result: RiskTriageResult = Field(
        ...,
        description="Risk classification result"
    )
    decision: Optional[ManTaskDecision] = Field(
        default=None,
        description="Human decision (null if pending)"
    )
    created_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z",
        description="ISO 8601 timestamp of creation"
    )
    expires_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp when task expires"
    )

    model_config = {"frozen": True}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def create_idempotency_key(workflow_id: str, step_id: str) -> str:
    """
    Create a deterministic idempotency key for a MAN task.

    Format: {workflow_id}:{step_id}

    This ensures that re-execution of the same workflow step
    doesn't create duplicate approval tasks.
    """
    return f"{workflow_id}:{step_id}"
