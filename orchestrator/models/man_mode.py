"""
Data models for Manual Assistance Needed (MAN) mode.

MAN mode provides human-in-the-loop safety for high-risk actions in the
APEX Orchestrator. Actions are triaged by risk level and may require
manual approval before execution.
"""

from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel


class ManLane(Enum):
    """Risk levels for action triage."""

    GREEN = "green"      # Low risk - auto-approve
    YELLOW = "yellow"    # Medium risk - review optional
    RED = "red"          # High risk - manual approval required
    BLOCKED = "blocked"  # Critical risk - always blocked


class ActionIntent(BaseModel):
    """Represents an action that may need manual review."""

    tool_name: str
    workflow_id: str
    params: Dict[str, Any]
    irreversible: bool = False
    workflow_key: Optional[str] = None
    step_id: Optional[str] = None
    tenant_id: Optional[str] = None
    requested_by: Optional[str] = None


class ManTask(BaseModel):
    """A manual review task pending human decision."""

    id: str
    idempotency_key: str
    status: str  # PENDING, APPROVED, DENIED
    intent: Dict[str, Any]
    decision: Optional[Dict[str, Any]] = None


class RiskTriageResult(BaseModel):
    """Result of risk triage for an action intent."""

    lane: ManLane
    reason: str
