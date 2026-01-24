"""OmniTrace: Observability and tracing utilities for the orchestrator.

Provides:
- Canonical JSON serialization for deterministic hashing
- Content-based hashing for deduplication
- Sensitive data redaction for audit logs
- Payload truncation for storage efficiency
- Event key generation for tracing
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

# Maximum payload size before truncation (32KB)
MAX_PAYLOAD_SIZE = 32 * 1024

# Maximum length for string values before they're considered for redaction
MAX_SAFE_STRING_LENGTH = 20

# Threshold for numeric values that should be hashed
LARGE_NUMBER_THRESHOLD = 10000

# Keys that are always preserved (essential for tracing)
ALLOWLIST_KEYS: frozenset[str] = frozenset({
    "id",
    "workflow_id",
    "run_id",
    "step",
    "step_id",
    "event_type",
    "timestamp",
    "status",
    "retry_count",
    "attempt",
    "version",
    "type",
    "name",
    "action",
    "lane",
    "result",
    "success",
    "error_code",
    "duration_ms",
})

# Keys that are always dropped (sensitive data)
DROPLIST_KEYS: frozenset[str] = frozenset({
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
})

# Patterns in key names that indicate sensitive data
SENSITIVE_PATTERNS: tuple[str, ...] = (
    "email",
    "phone",
    "address",
    "ssn",
    "social_security",
    "credit_card",
    "card_number",
    "cvv",
    "pin",
    "account_number",
    "routing_number",
    "bank",
    "salary",
    "income",
    "dob",
    "birth",
    "passport",
    "license",
    "user_",
    "customer_",
    "client_",
    "personal_",
)


def canonical_json(data: Any) -> str:
    """Create deterministic JSON representation.

    Args:
        data: Any JSON-serializable data structure.

    Returns:
        A JSON string with sorted keys and no extra whitespace.
    """
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def compute_hash(data: Any, length: int = 16) -> str:
    """Compute a content-based hash for data.

    Args:
        data: Any JSON-serializable data structure.
        length: Number of hex characters to return (default 16).

    Returns:
        A hex string hash of the canonical JSON representation.
    """
    canonical = canonical_json(data)
    full_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return full_hash[:length]


def _is_sensitive_key(key: str) -> bool:
    """Check if a key name indicates sensitive data."""
    key_lower = key.lower()

    # Check droplist
    if key_lower in DROPLIST_KEYS:
        return True

    # Check sensitive patterns
    for pattern in SENSITIVE_PATTERNS:
        if pattern in key_lower:
            return True

    return False


def _is_allowlisted_key(key: str) -> bool:
    """Check if a key is in the allowlist."""
    return key.lower() in ALLOWLIST_KEYS


def _should_redact_value(value: Any) -> bool:
    """Check if a value should be redacted based on its content."""
    if isinstance(value, str):
        # Redact long strings (potential PII)
        if len(value) > MAX_SAFE_STRING_LENGTH:
            return True
        # Check for email patterns
        if re.search(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            return True
    elif isinstance(value, (int, float)):
        # Redact large numbers (potential account numbers, etc.)
        if abs(value) > LARGE_NUMBER_THRESHOLD:
            return True

    return False


def _redact_value(value: Any) -> str:
    """Redact a value by hashing it."""
    return f"<redacted:{compute_hash(value)}>"


def redact_dict(
    data: dict[str, Any],
    depth: int = 0,
    max_depth: int = 10,
) -> dict[str, Any]:
    """Redact sensitive data from a dictionary.

    Redaction rules:
    1. Allowlisted keys are always preserved.
    2. Droplisted keys are always removed (replaced with redacted marker).
    3. Keys matching sensitive patterns are redacted.
    4. Unknown keys with long string values are redacted.
    5. Large numbers are redacted.
    6. Nested dictionaries are recursively processed.

    Args:
        data: Dictionary to redact.
        depth: Current recursion depth.
        max_depth: Maximum recursion depth.

    Returns:
        A new dictionary with sensitive values redacted.
    """
    if depth >= max_depth:
        return {"<truncated>": "max depth exceeded"}

    result: dict[str, Any] = {}

    for key, value in data.items():
        # Always preserve allowlisted keys
        if _is_allowlisted_key(key):
            if isinstance(value, dict):
                result[key] = redact_dict(value, depth + 1, max_depth)
            else:
                result[key] = value
            continue

        # Always redact sensitive keys
        if _is_sensitive_key(key):
            result[key] = _redact_value(value)
            continue

        # Process nested dictionaries
        if isinstance(value, dict):
            result[key] = redact_dict(value, depth + 1, max_depth)
            continue

        # Process lists
        if isinstance(value, list):
            result[key] = [
                redact_dict(item, depth + 1, max_depth)
                if isinstance(item, dict)
                else (
                    _redact_value(item)
                    if _should_redact_value(item)
                    else item
                )
                for item in value
            ]
            continue

        # For unknown keys, check if the value should be redacted
        if _should_redact_value(value):
            result[key] = _redact_value(value)
        else:
            result[key] = value

    return result


def truncate_payload(
    payload: dict[str, Any],
    max_size: int = MAX_PAYLOAD_SIZE,
) -> dict[str, Any]:
    """Truncate a payload if it exceeds the maximum size.

    Preserves essential fields (workflow_id, id, event_type) even when truncating.

    Args:
        payload: The payload to potentially truncate.
        max_size: Maximum size in bytes.

    Returns:
        The original payload or a truncated version.
    """
    serialized = canonical_json(payload)

    if len(serialized) <= max_size:
        return payload

    # Preserve essential fields
    essential_keys = {"workflow_id", "id", "event_type", "timestamp", "status"}
    truncated: dict[str, Any] = {
        k: v for k, v in payload.items() if k in essential_keys
    }
    truncated["<truncated>"] = True
    truncated["original_size"] = len(serialized)

    return truncated


def event_key(
    workflow_id: str,
    event_type: str,
    step: str | None = None,
    retry_count: int = 0,
    timestamp: str | None = None,
) -> str:
    """Generate a unique event key for tracing.

    Args:
        workflow_id: The workflow identifier.
        event_type: Type of event (e.g., "tool_call", "step_complete").
        step: Optional step identifier.
        retry_count: Retry attempt number.
        timestamp: Optional timestamp for uniqueness.

    Returns:
        A unique event key string.
    """
    components = [workflow_id, event_type]

    if step:
        components.append(step)

    components.append(str(retry_count))

    if timestamp:
        components.append(timestamp)

    key_data = ":".join(components)
    key_hash = compute_hash(key_data, length=8)

    return f"{event_type}:{workflow_id[:8]}:{key_hash}"
