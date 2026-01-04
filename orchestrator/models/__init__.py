"""
Universal Schema models for APEX Orchestrator.

This module defines the Canonical Data Model (CDM) using Pydantic v2,
matching the TypeScript EventEnvelope contracts from sim/contracts.ts.

All inter-service communication MUST use these models to ensure type safety
and compatibility across the TypeScript/Python boundary.
"""

from models.events import (
    AgentEvent,
    AppName,
    ChaosMetadata,
    EventEnvelope,
    EventType,
    GoalReceived,
    PlanGenerated,
    ToolCallRequested,
    ToolResultReceived,
    TraceContext,
    WorkflowCompleted,
    WorkflowFailed,
)

__all__ = [
    "AgentEvent",
    "AppName",
    "ChaosMetadata",
    "EventEnvelope",
    "EventType",
    "GoalReceived",
    "PlanGenerated",
    "ToolCallRequested",
    "ToolResultReceived",
    "TraceContext",
    "WorkflowCompleted",
    "WorkflowFailed",
]
