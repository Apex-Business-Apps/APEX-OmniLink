"""MAN Mode (Manual-Authorization-Needed) domain models."""

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
    """Represents a single tool call that needs human review."""

    tool_name: str
    tool_params: Dict[str, Any] = Field(default_factory=dict)
    workflow_id: str
    step_id: str
    agent_rationale: Optional[str] = None
    irreversible: bool = False

    class Config:
        frozen = True


class RiskTriageResult(BaseModel):
    """Output from the MAN triage logic."""

    lane: ManLane
    reason: str
    risk_factors: List[str] = Field(default_factory=list)
    suggested_timeout_hours: int = 24


class ManTaskDecision(BaseModel):
    """Human operator's verdict."""

    decision: ManTaskStatus
    operator_id: str
    operator_notes: Optional[str] = None
    decided_at: datetime = Field(default_factory=datetime.utcnow)


class ManTask(BaseModel):
    """A pending MAN-mode approval ticket."""

    task_id: UUID = Field(default_factory=uuid4)
    intent: ActionIntent
    triage: RiskTriageResult
    status: ManTaskStatus = ManTaskStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decision: Optional[ManTaskDecision] = None


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
