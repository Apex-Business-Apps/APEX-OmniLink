from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ManLane(str, Enum):
    """Risk classification lanes for Manual Assistance Needed (MAN) mode."""

    GREEN = "GREEN"  # Automated execution allowed
    YELLOW = "YELLOW"  # Automated but logged/notify
    RED = "RED"  # Blocked, requires human approval
    BLOCKED = "BLOCKED"  # Permanently denied by policy


class RiskTriageResult(BaseModel):
    """Result of a risk assessment policy check."""

    lane: ManLane
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Risk score (0.0=safe, 1.0=max)")
    reasons: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ManTaskStatus(str, Enum):
    """Status of a manual intervention task."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    MODIFIED = "MODIFIED"


class ManDecision(BaseModel):
    """Human decision payload."""

    status: ManTaskStatus
    reason: Optional[str] = None
    modified_input: Optional[Dict[str, Any]] = None
    operator_id: Optional[str] = None


class ManTask(BaseModel):
    """A persistent task requiring human intervention."""

    id: UUID
    idempotency_key: str
    tenant_id: str
    workflow_id: str
    run_id: str
    step_id: str
    tool_name: str
    tool_input: Dict[str, Any]
    triage_result: RiskTriageResult
    status: ManTaskStatus
    decision: Optional[ManDecision] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
