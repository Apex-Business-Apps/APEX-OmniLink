"""MAN Mode (Manual-Authorization-Needed) domain models.

This module defines the core data structures for the human-in-the-loop
safety system that gates high-risk agent actions.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ManLane(str, Enum):
    """Traffic-light lanes for action risk."""

    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"
    BLOCKED = "BLOCKED"

    def __str__(self) -> str:
        """Return the value for string representation."""
        return self.value


class ManTaskStatus(str, Enum):
    """Lifecycle of a MAN task."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    EXPIRED = "EXPIRED"

    def __str__(self) -> str:
        """Return the value for string representation."""
        return self.value


class ActionIntent(BaseModel):
    """Action proposed by agent requiring risk evaluation.

    Attributes:
        tool_name: Identifier of the tool to execute
        params: Parameters to pass to the tool
        workflow_id: Parent workflow identifier for tracing
        step_id: Unique step identifier within workflow (optional, defaults to empty)
        irreversible: Flag indicating action cannot be undone
        context: Additional context for risk evaluation
    """

    tool_name: str = Field(..., description="Tool identifier")
    params: dict[str, Any] = Field(default_factory=dict, description="Tool execution parameters")
    workflow_id: str = Field(..., description="Parent workflow ID")
    step_id: str = Field(default="", description="Unique step identifier")
    irreversible: bool = Field(default=False, description="Action cannot be reversed")
    context: Optional[dict[str, Any]] = Field(default=None, description="Additional context")

    model_config = {"frozen": True}


class RiskTriageResult(BaseModel):
    """Output from risk policy evaluation.

    Attributes:
        lane: Risk classification (GREEN/YELLOW/RED/BLOCKED)
        reason: Human-readable explanation of classification
        requires_approval: Whether human gate is needed
        risk_factors: List of factors that contributed to classification
        suggested_timeout_hours: Suggested timeout for approval in hours
    """

    lane: ManLane = Field(..., description="Risk classification lane")
    reason: str = Field(..., description="Classification rationale")
    requires_approval: bool = Field(..., description="Human approval required")
    risk_factors: list[str] = Field(default_factory=list, description="Contributing risk factors")
    suggested_timeout_hours: int = Field(default=24, description="Approval timeout in hours")


class ManTaskDecision(BaseModel):
    """Human decision on approval task.

    Attributes:
        status: Approval decision (APPROVED/DENIED)
        reason: Human-provided rationale
        decided_by: Identity of decision maker
        decided_at: Timestamp of decision
        metadata: Additional decision context
    """

    status: ManTaskStatus = Field(..., description="Decision outcome")
    reason: Optional[str] = Field(default=None, description="Decision rationale")
    decided_by: str = Field(default="unknown", description="Decision maker identity")
    decided_at: datetime = Field(default_factory=datetime.utcnow, description="Decision timestamp")
    metadata: Optional[dict[str, Any]] = Field(default=None, description="Additional context")


class ManTask(BaseModel):
    """Durable approval task record.

    Represents a single action awaiting human review.
    Stored in man_tasks database table.

    Attributes:
        id: Unique task identifier
        idempotency_key: Prevents duplicate task creation
        workflow_id: Parent workflow identifier
        step_id: Step identifier within workflow
        status: Current task state (PENDING/APPROVED/DENIED)
        intent: Original action requiring approval
        triage_result: Risk triage result
        decision: Human decision (null until decided)
        created_at: Task creation timestamp
    """

    id: UUID = Field(default_factory=uuid4, description="Task ID")
    idempotency_key: str = Field(..., description="Unique key for idempotent creation")
    workflow_id: str = Field(..., description="Parent workflow ID")
    step_id: str = Field(default="", description="Step identifier")
    status: ManTaskStatus = Field(default=ManTaskStatus.PENDING, description="Task status")
    intent: ActionIntent = Field(..., description="Proposed action")
    triage_result: Optional[RiskTriageResult] = Field(
        default=None, description="Risk triage result"
    )
    decision: Optional[ManTaskDecision] = Field(
        default=None, description="Human decision (null until decided)"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")


def create_idempotency_key(workflow_id: str, step_id: str) -> str:
    """Generate idempotency key for task creation.

    Args:
        workflow_id: Parent workflow identifier
        step_id: Step identifier within workflow

    Returns:
        Idempotency key in format "{workflow_id}:{step_id}"

    Example:
        >>> create_idempotency_key("wf-123", "step-5")
        'wf-123:step-5'
    """
    return f"{workflow_id}:{step_id}"
