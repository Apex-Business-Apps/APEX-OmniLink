"""MAN Mode (Manual-Authorization-Needed) domain models.

This module defines the core data structures for the human-in-the-loop
safety system that gates high-risk agent actions.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class IdempotencyKey(BaseModel):
    """Unique identifier for deduplicating workflow steps."""

    workflow_id: str
    step_id: str

    def __hash__(self) -> int:
        return hash((self.workflow_id, self.step_id))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, IdempotencyKey):
            return False
        return self.workflow_id == other.workflow_id and self.step_id == other.step_id


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
    """A pending MAN-mode approval ticket."""

    task_id: UUID = Field(default_factory=uuid4)
    intent: ActionIntent
    triage: RiskTriageResult
    status: ManTaskStatus = ManTaskStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decision: Optional[ManTaskDecision] = None


def create_idempotency_key(workflow_id: str, step_id: str) -> str:
    """Create an idempotency key from workflow and step IDs.

    Args:
        workflow_id: The workflow identifier
        step_id: The step identifier within the workflow

    Returns:
        A string key in format "workflow_id:step_id"
    """
    return f"{workflow_id}:{step_id}"
