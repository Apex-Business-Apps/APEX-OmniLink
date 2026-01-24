"""
OmniTrace Recorder - Workflow Observability & Replay Support.

This module provides idempotent, best-effort telemetry for workflow runs.

Key Guarantees:
1. NEVER raises exceptions - telemetry failures must not break workflows
2. Idempotent writes - safe for Temporal retries (unique constraints + upsert)
3. Bounded event volume - caps per run, payload size limits, sampling
4. Privacy-first - allowlist-based redaction, sensitive data hashed

Configuration (environment variables):
- OMNITRACE_SAMPLE_RATE: Sampling rate (0.0-1.0, default 1.0 in dev, 0.1 in prod)
- OMNITRACE_MAX_EVENTS_PER_RUN: Max events per workflow (default 200)
- OMNITRACE_MAX_EVENT_BYTES: Max payload size in bytes (default 8192)
- OMNITRACE_ENABLED: Enable/disable tracing (default true)
"""

import hashlib
import json
import logging
import os
import secrets
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Sampling rate: 1.0 = 100% of runs traced
_DEFAULT_SAMPLE_RATE_DEV = 1.0
_DEFAULT_SAMPLE_RATE_PROD = 0.1

# Event caps
_DEFAULT_MAX_EVENTS_PER_RUN = 200
_DEFAULT_MAX_EVENT_BYTES = 8192  # 8KB

# Allowlisted keys for redaction (these are preserved, others hashed/dropped)
REDACTION_ALLOWLIST = frozenset(
    {
        # Identifiers (safe to log)
        "id",
        "workflow_id",
        "trace_id",
        "step_id",
        "plan_id",
        "run_id",
        "event_key",
        "correlation_id",
        "request_id",
        "task_id",
        # Status/metadata
        "status",
        "success",
        "error",
        "kind",
        "type",
        "name",
        "tool",
        "lane",
        "reason",
        "action",
        "method",
        # Timing
        "latency_ms",
        "duration_ms",
        "timestamp",
        "created_at",
        "updated_at",
        # Counts (safe integers)
        "count",
        "total_steps",
        "event_count",
        "attempt",
        "retry_count",
        # Classification
        "cache_hit",
        "template_id",
        "irreversible",
    }
)

# Keys that should be completely dropped (never logged even as hash)
REDACTION_DROPLIST = frozenset(
    {
        "password",
        "secret",
        "token",
        "api_key",
        "apikey",
        "auth",
        "authorization",
        "credential",
        "private_key",
        "privatekey",
        "access_token",
        "refresh_token",
        "session",
        "cookie",
    }
)


# =============================================================================
# CORE UTILITIES
# =============================================================================


def get_sample_rate() -> float:
    """Get configured sample rate."""
    env_rate = os.getenv("OMNITRACE_SAMPLE_RATE")
    if env_rate:
        try:
            return max(0.0, min(1.0, float(env_rate)))
        except ValueError:
            pass

    # Default based on environment
    is_prod = os.getenv("ENVIRONMENT", "").lower() == "production"
    return _DEFAULT_SAMPLE_RATE_PROD if is_prod else _DEFAULT_SAMPLE_RATE_DEV


def get_max_events_per_run() -> int:
    """Get max events per run."""
    try:
        return int(os.getenv("OMNITRACE_MAX_EVENTS_PER_RUN", _DEFAULT_MAX_EVENTS_PER_RUN))
    except ValueError:
        return _DEFAULT_MAX_EVENTS_PER_RUN


def get_max_event_bytes() -> int:
    """Get max event payload size."""
    try:
        return int(os.getenv("OMNITRACE_MAX_EVENT_BYTES", _DEFAULT_MAX_EVENT_BYTES))
    except ValueError:
        return _DEFAULT_MAX_EVENT_BYTES


def is_omnitrace_enabled() -> bool:
    """Check if OmniTrace is enabled."""
    return os.getenv("OMNITRACE_ENABLED", "true").lower() in ("true", "1", "yes")


def canonical_json(obj: Any) -> str:
    """
    Convert object to canonical JSON string (sorted keys, no whitespace).

    This ensures consistent hashing across different Python versions/platforms.
    """
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def compute_hash(data: Any) -> str:
    """Compute SHA256 hash of data in canonical JSON form."""
    canonical = canonical_json(data)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def redact_value(key: str, value: Any, depth: int = 0) -> Any:
    """
    Redact a single value based on key and content.

    Args:
        key: The key name (used for allowlist/droplist check)
        value: The value to potentially redact
        depth: Current recursion depth (prevent infinite recursion)

    Returns:
        Original value if allowed, hashed placeholder if not, or None if dropped
    """
    key_lower = key.lower()

    # Drop sensitive keys entirely
    if any(drop in key_lower for drop in REDACTION_DROPLIST):
        return None

    # Allow known safe keys
    if key_lower in REDACTION_ALLOWLIST:
        return value

    # For nested structures, recursively redact
    if depth < 3:  # Limit recursion depth
        if isinstance(value, dict):
            return redact_dict(value, depth + 1)
        if isinstance(value, list) and len(value) <= 10:
            return [redact_value(f"{key}[{i}]", v, depth + 1) for i, v in enumerate(value)]

    # For other values, return type indicator with hash
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        # Safe to include small numbers
        if -1000000 <= value <= 1000000:
            return value
        return f"<number:{compute_hash(value)}>"
    if isinstance(value, str):
        if len(value) <= 50 and not any(c in value for c in "@./\\:"):
            # Short, simple strings might be safe (enums, status codes)
            return value
        return f"<redacted:{compute_hash(value)}>"

    return f"<{type(value).__name__}:{compute_hash(value)}>"


def redact_dict(data: dict[str, Any], depth: int = 0) -> dict[str, Any]:
    """
    Redact a dictionary, keeping only allowlisted keys.

    Args:
        data: Dictionary to redact
        depth: Current recursion depth

    Returns:
        Redacted dictionary
    """
    if not isinstance(data, dict):
        return {}

    result = {}
    for key, value in data.items():
        redacted = redact_value(key, value, depth)
        if redacted is not None:
            result[key] = redacted

    return result


def truncate_payload(data: dict[str, Any], max_bytes: int) -> dict[str, Any]:
    """
    Truncate payload to fit within size limit.

    Progressively removes large string values until under limit.
    """
    serialized = canonical_json(data)
    if len(serialized.encode("utf-8")) <= max_bytes:
        return data

    # Make a copy to modify
    result = dict(data)

    # Find and truncate large string values
    for key, value in list(result.items()):
        if isinstance(value, str) and len(value) > 100:
            result[key] = f"{value[:50]}...<truncated>"
        elif isinstance(value, dict):
            result[key] = {"_truncated": True, "_hash": compute_hash(value)}
        elif isinstance(value, list) and len(value) > 5:
            result[key] = value[:5] + [f"...<{len(value) - 5} more>"]

        # Check if we're under limit now
        if len(canonical_json(result).encode("utf-8")) <= max_bytes:
            return result

    # Last resort: just keep essential fields
    return {
        "_truncated": True,
        "_original_hash": compute_hash(data),
        "workflow_id": data.get("workflow_id"),
        "status": data.get("status"),
    }


# =============================================================================
# OMNITRACE RECORDER
# =============================================================================


@dataclass
class OmniTraceRecorder:
    """
    Records workflow runs and events to the database.

    Thread-safe, best-effort recording that never raises exceptions.

    Usage:
        recorder = OmniTraceRecorder(workflow_id="wf-123", trace_id="trace-abc")

        # Check if this run should be sampled
        if recorder.should_record():
            recorder.record_run_start(user_id, input_data)

            # Record events during execution
            recorder.record_event(
                event_key="tool:step1:search_database:1",
                kind="tool",
                name="search_database",
                latency_ms=150,
                data={"query": "..."}
            )

            recorder.record_run_complete(output_data)
    """

    workflow_id: str
    trace_id: str

    # Internal state
    _sampled: bool = field(default=False, init=False)
    _sample_decision_made: bool = field(default=False, init=False)
    _event_count: int = field(default=0, init=False)
    _error_count: int = field(default=0, init=False)
    _error_logged: bool = field(default=False, init=False)
    _db_provider: Any = field(default=None, init=False)

    def should_record(self) -> bool:
        """
        Determine if this workflow should be recorded (sampling decision).

        Decision is made once and cached for consistency within a run.
        """
        if not is_omnitrace_enabled():
            return False

        if not self._sample_decision_made:
            sample_rate = get_sample_rate()
            # Use secrets for cryptographically secure sampling
            self._sampled = (secrets.randbelow(1000) / 1000.0) < sample_rate
            self._sample_decision_made = True
            logger.debug(
                f"OmniTrace sample decision: {self._sampled} "
                f"(rate={sample_rate}, workflow={self.workflow_id})"
            )

        return self._sampled

    def _get_db(self) -> Any:
        """Get database provider (lazy initialization)."""
        if self._db_provider is None:
            try:
                from providers.database.factory import get_database_provider

                self._db_provider = get_database_provider()
            except Exception as e:
                self._handle_error("db_init", e)
                return None
        return self._db_provider

    def _handle_error(self, operation: str, error: Exception) -> None:
        """
        Handle telemetry errors (best-effort, never raise).

        Logs once per run to avoid log spam, increments error counter.
        """
        self._error_count += 1

        if not self._error_logged:
            self._error_logged = True
            logger.warning(
                f"OmniTrace {operation} failed (workflow={self.workflow_id}): {error}. "
                "Subsequent errors will be counted but not logged."
            )

    async def record_run_start(
        self,
        user_id: str | None,
        input_data: dict[str, Any],
        status: str = "running",
    ) -> None:
        """
        Record workflow run start (upsert).

        Args:
            user_id: User who initiated the run (optional)
            input_data: Workflow input (will be redacted)
            status: Initial status (default: running)
        """
        if not self.should_record():
            return

        try:
            db = self._get_db()
            if db is None:
                return

            # Redact and hash input
            input_redacted = redact_dict(input_data)
            input_redacted = truncate_payload(input_redacted, get_max_event_bytes())
            input_hash = compute_hash(input_data)

            # Upsert run via RPC function
            await db.rpc(
                "omnitrace_upsert_run",
                {
                    "p_workflow_id": self.workflow_id,
                    "p_trace_id": self.trace_id,
                    "p_user_id": user_id,
                    "p_status": status,
                    "p_input_redacted": input_redacted,
                    "p_output_redacted": None,
                    "p_input_hash": input_hash,
                    "p_output_hash": None,
                    "p_event_count": 0,
                },
            )

            logger.debug(f"OmniTrace: recorded run start (workflow={self.workflow_id})")

        except Exception as e:
            self._handle_error("record_run_start", e)

    async def record_run_complete(
        self,
        output_data: dict[str, Any] | None = None,
        status: str = "completed",
    ) -> None:
        """
        Record workflow completion (upsert).

        Args:
            output_data: Workflow output (will be redacted)
            status: Final status (completed, failed, cancelled)
        """
        if not self.should_record():
            return

        try:
            db = self._get_db()
            if db is None:
                return

            # Redact and hash output
            output_redacted = None
            output_hash = None
            if output_data:
                output_redacted = redact_dict(output_data)
                output_redacted = truncate_payload(output_redacted, get_max_event_bytes())
                output_hash = compute_hash(output_data)

            # Record final error count as system event if there were errors
            if self._error_count > 0 and self._event_count < get_max_events_per_run():
                await self._record_event_internal(
                    event_key=f"system:omnitrace_errors:{self.workflow_id}",
                    kind="system",
                    name="omnitrace_errors",
                    latency_ms=None,
                    data={"error_count": self._error_count},
                )

            # Upsert run completion
            await db.rpc(
                "omnitrace_upsert_run",
                {
                    "p_workflow_id": self.workflow_id,
                    "p_trace_id": self.trace_id,
                    "p_user_id": None,  # Don't update user_id on completion
                    "p_status": status,
                    "p_input_redacted": {},  # Don't update input on completion
                    "p_output_redacted": output_redacted,
                    "p_input_hash": "",  # Don't update input hash
                    "p_output_hash": output_hash,
                    "p_event_count": self._event_count,
                },
            )

            logger.debug(
                f"OmniTrace: recorded run complete "
                f"(workflow={self.workflow_id}, status={status}, events={self._event_count})"
            )

        except Exception as e:
            self._handle_error("record_run_complete", e)

    async def record_event(
        self,
        event_key: str,
        kind: str,
        name: str,
        latency_ms: int | None = None,
        data: dict[str, Any] | None = None,
    ) -> None:
        """
        Record a workflow event (idempotent insert).

        Args:
            event_key: Unique key for idempotency (e.g., "tool:step1:search:1")
            kind: Event type (tool, model, policy, cache, system)
            name: Event name (tool name, model name, etc.)
            latency_ms: Event duration in milliseconds
            data: Event data (will be redacted)
        """
        if not self.should_record():
            return

        # Check event cap
        if self._event_count >= get_max_events_per_run():
            logger.debug(
                f"OmniTrace: event cap reached "
                f"(workflow={self.workflow_id}, cap={get_max_events_per_run()})"
            )
            return

        await self._record_event_internal(event_key, kind, name, latency_ms, data)

    async def _record_event_internal(
        self,
        event_key: str,
        kind: str,
        name: str,
        latency_ms: int | None,
        data: dict[str, Any] | None,
    ) -> None:
        """Internal event recording (no cap check)."""
        try:
            db = self._get_db()
            if db is None:
                return

            # Redact and hash data
            data_redacted = redact_dict(data or {})
            data_redacted = truncate_payload(data_redacted, get_max_event_bytes())
            data_hash = compute_hash(data or {})

            # Insert event (ON CONFLICT DO NOTHING)
            await db.rpc(
                "omnitrace_insert_event",
                {
                    "p_workflow_id": self.workflow_id,
                    "p_event_key": event_key,
                    "p_kind": kind,
                    "p_name": name,
                    "p_latency_ms": latency_ms,
                    "p_data_redacted": data_redacted,
                    "p_data_hash": data_hash,
                },
            )

            self._event_count += 1
            logger.debug(
                f"OmniTrace: recorded event {event_key} "
                f"(workflow={self.workflow_id}, count={self._event_count})"
            )

        except Exception as e:
            self._handle_error("record_event", e)


# =============================================================================
# SINGLETON FACTORY
# =============================================================================

# Cache of recorders by workflow_id (weak references would be better in production)
_recorders: dict[str, OmniTraceRecorder] = {}


def get_omnitrace_recorder(workflow_id: str, trace_id: str) -> OmniTraceRecorder:
    """
    Get or create an OmniTrace recorder for a workflow.

    Args:
        workflow_id: Temporal workflow ID
        trace_id: Distributed trace ID

    Returns:
        OmniTraceRecorder instance
    """
    if workflow_id not in _recorders:
        _recorders[workflow_id] = OmniTraceRecorder(
            workflow_id=workflow_id,
            trace_id=trace_id,
        )
    return _recorders[workflow_id]


def clear_recorder(workflow_id: str) -> None:
    """Remove recorder from cache (call on workflow completion)."""
    _recorders.pop(workflow_id, None)


# =============================================================================
# ACTIVITY DECORATOR HELPER
# =============================================================================


def trace_tool_execution(step_id: str, tool_name: str, attempt: int = 1):
    """
    Decorator/context manager for tracing tool execution.

    Usage as decorator:
        @trace_tool_execution("step1", "search_database")
        async def my_activity(params):
            ...

    Usage as context manager:
        async with trace_tool_execution("step1", "search_database", attempt=2):
            result = await execute_tool(...)
    """

    class TraceContext:
        def __init__(self, workflow_id: str, trace_id: str):
            self.workflow_id = workflow_id
            self.trace_id = trace_id
            self.start_time: float = 0
            self.recorder: OmniTraceRecorder | None = None

        async def __aenter__(self):
            self.start_time = time.time()
            self.recorder = get_omnitrace_recorder(self.workflow_id, self.trace_id)
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            if self.recorder is None:
                return False

            latency_ms = int((time.time() - self.start_time) * 1000)
            event_key = f"tool:{step_id}:{tool_name}:{attempt}"

            await self.recorder.record_event(
                event_key=event_key,
                kind="tool",
                name=tool_name,
                latency_ms=latency_ms,
                data={
                    "step_id": step_id,
                    "tool": tool_name,
                    "attempt": attempt,
                    "success": exc_type is None,
                    "error": str(exc_val) if exc_val else None,
                },
            )
            return False  # Don't suppress exceptions

    return TraceContext
