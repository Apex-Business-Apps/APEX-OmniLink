"""MAN Mode (Manual-Authorization-Needed) domain models."""

This module defines the core data structures for the human-in-the-loop
safety system that gates high-risk agent actions.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ManLane(str, Enum):
    """Traffic-light lanes for action risk."""

    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"
    BLOCKED = "BLOCKED"


class ManTaskStatus(str, Enum):
    """Lifecycle of a MAN task."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    EXPIRED = "EXPIRED"
    ESCALATED = "ESCALATED"


class ActionIntent(BaseModel):
    """Action proposed by agent requiring risk evaluation.

    Attributes:
        tool_name: Identifier of the tool to execute
        params: Parameters to pass to the tool
        workflow_id: Parent workflow identifier for tracing
        step_id: Unique step identifier within workflow
        irreversible: Flag indicating action cannot be undone
        metadata: Additional context for risk evaluation
    """

    tool_name: str = Field(..., description="Tool identifier")
    params: Dict[str, Any] = Field(default_factory=dict, description="Tool execution parameters")
    workflow_id: str = Field(..., description="Parent workflow ID")
    step_id: str = Field(..., description="Unique step identifier")
    irreversible: bool = Field(default=False, description="Action cannot be reversed")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context")

    class Config:
        frozen = True


class RiskTriageResult(BaseModel):
    """Output from risk policy evaluation.

    Attributes:
        lane: Risk classification (GREEN/YELLOW/RED/BLOCKED)
        reason: Human-readable explanation of classification
        requires_approval: Whether human gate is needed
        timeout_seconds: Max wait time for approval (default 86400 = 24h)
        metadata: Additional policy evaluation context
    """

    lane: ManLane = Field(..., description="Risk classification lane")
    reason: str = Field(..., description="Classification rationale")
    requires_approval: bool = Field(..., description="Human approval required")
    timeout_seconds: int = Field(
        default=86400,
        description="Approval timeout (default 24h)",
        ge=60,
        le=604800,  # Max 7 days
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Policy evaluation details")


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
    reason: str = Field(default="", description="Decision rationale")
    decided_by: str = Field(..., description="Decision maker identity")
    decided_at: datetime = Field(default_factory=datetime.utcnow, description="Decision timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context")


class ManTask(BaseModel):
    """Durable approval task record.

    Represents a single action awaiting human review.
    Stored in man_tasks database table.

    Attributes:
        id: Unique task identifier
        idempotency_key: Prevents duplicate task creation
        workflow_id: Parent workflow identifier
        status: Current task state (PENDING/APPROVED/DENIED)
        intent: Original action requiring approval
        decision: Human decision (null until decided)
        created_at: Task creation timestamp
    """

    id: UUID = Field(default_factory=uuid4, description="Task ID")
    idempotency_key: str = Field(..., description="Unique key for idempotent creation")
    workflow_id: str = Field(..., description="Parent workflow ID")
    status: ManTaskStatus = Field(default=ManTaskStatus.PENDING, description="Task status")
    intent: ActionIntent = Field(..., description="Proposed action")
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
