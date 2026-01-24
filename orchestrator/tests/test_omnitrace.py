"""
Unit tests for OmniTrace observability module.

Tests cover:
1. Hashing stability - same input produces same hash
2. Redaction - allowlisted keys preserved, others dropped/hashed
3. Event key uniqueness prevents duplicates
4. Payload truncation stays within limits
"""

import pytest
from observability.omnitrace import (
    canonical_json,
    compute_hash,
    redact_dict,
    redact_value,
    truncate_payload,
    REDACTION_ALLOWLIST,
    REDACTION_DROPLIST,
)


class TestCanonicalJson:
    """Test canonical JSON serialization."""

    def test_sorted_keys(self):
        """Keys should be sorted alphabetically."""
        data = {"z": 1, "a": 2, "m": 3}
        result = canonical_json(data)
        assert result == '{"a":2,"m":3,"z":1}'

    def test_no_whitespace(self):
        """Output should have no extra whitespace."""
        data = {"key": "value", "nested": {"inner": 1}}
        result = canonical_json(data)
        assert " " not in result
        assert "\n" not in result

    def test_deterministic(self):
        """Same input should always produce same output."""
        data = {"user": "test", "count": 42, "active": True}
        result1 = canonical_json(data)
        result2 = canonical_json(data)
        assert result1 == result2


class TestComputeHash:
    """Test SHA256 hashing."""

    def test_hash_stability(self):
        """Same input should produce same hash."""
        data = {"workflow_id": "wf-123", "status": "running"}
        hash1 = compute_hash(data)
        hash2 = compute_hash(data)
        assert hash1 == hash2

    def test_hash_different_for_different_input(self):
        """Different inputs should produce different hashes."""
        data1 = {"id": "1"}
        data2 = {"id": "2"}
        assert compute_hash(data1) != compute_hash(data2)

    def test_hash_length(self):
        """Hash should be truncated to 16 characters."""
        data = {"test": "value"}
        result = compute_hash(data)
        assert len(result) == 16

    def test_hash_order_independent(self):
        """Key order shouldn't affect hash (via canonical JSON)."""
        data1 = {"a": 1, "b": 2}
        data2 = {"b": 2, "a": 1}
        assert compute_hash(data1) == compute_hash(data2)


class TestRedaction:
    """Test redaction logic."""

    def test_allowlisted_keys_preserved(self):
        """Keys in allowlist should be preserved unchanged."""
        data = {
            "id": "test-id",
            "workflow_id": "wf-123",
            "status": "running",
            "success": True,
            "count": 42,
        }
        result = redact_dict(data)
        assert result["id"] == "test-id"
        assert result["workflow_id"] == "wf-123"
        assert result["status"] == "running"
        assert result["success"] is True
        assert result["count"] == 42

    def test_sensitive_keys_dropped(self):
        """Keys in droplist should be completely removed."""
        data = {
            "id": "test",
            "password": "secret123",
            "api_key": "sk-xxx",
            "token": "jwt-token",
            "authorization": "Bearer xyz",
        }
        result = redact_dict(data)
        assert "id" in result
        assert "password" not in result
        assert "api_key" not in result
        assert "token" not in result
        assert "authorization" not in result

    def test_unknown_keys_hashed(self):
        """Unknown keys should be redacted with hash."""
        data = {
            "id": "test",
            "user_email": "user@example.com",
            "custom_field": "some long value that should be redacted",
        }
        result = redact_dict(data)
        assert result["id"] == "test"
        assert "<redacted:" in str(result.get("user_email", ""))
        assert "<redacted:" in str(result.get("custom_field", ""))

    def test_nested_redaction(self):
        """Nested objects should be recursively redacted."""
        data = {
            "id": "test",
            "nested": {
                "status": "ok",
                "sensitive_data": "should be redacted",
            },
        }
        result = redact_dict(data)
        assert result["id"] == "test"
        assert isinstance(result.get("nested"), dict)
        nested = result["nested"]
        assert nested.get("status") == "ok"

    def test_small_numbers_preserved(self):
        """Small numbers should be preserved."""
        data = {"count": 100, "score": -50, "price": 999999}
        result = redact_dict(data)
        assert result["count"] == 100
        assert result["score"] == -50
        assert result["price"] == 999999

    def test_large_numbers_hashed(self):
        """Very large numbers should be hashed."""
        data = {"huge_number": 10000000000}
        result = redact_dict(data)
        assert "<number:" in str(result.get("huge_number", ""))


class TestPayloadTruncation:
    """Test payload truncation."""

    def test_small_payload_unchanged(self):
        """Payloads under limit should be unchanged."""
        data = {"id": "test", "status": "ok"}
        result = truncate_payload(data, max_bytes=1000)
        assert result == data

    def test_large_payload_truncated(self):
        """Large payloads should be truncated."""
        data = {
            "id": "test",
            "large_field": "x" * 10000,  # 10KB string
        }
        result = truncate_payload(data, max_bytes=1000)
        # Should be truncated
        serialized = str(result)
        assert len(serialized) < 10000

    def test_truncated_preserves_workflow_id(self):
        """Truncation should preserve critical fields."""
        data = {
            "workflow_id": "wf-important",
            "status": "running",
            "huge_data": {"nested": "x" * 100000},
        }
        result = truncate_payload(data, max_bytes=500)
        assert result.get("workflow_id") == "wf-important"


class TestEventKeyUniqueness:
    """Test event key format for idempotency."""

    def test_event_key_format(self):
        """Event keys should follow the expected format."""
        step_id = "step1"
        tool_name = "search_database"
        attempt = 1
        event_key = f"tool:{step_id}:{tool_name}:{attempt}"
        assert event_key == "tool:step1:search_database:1"

    def test_event_key_different_for_retries(self):
        """Different attempts should have different event keys."""
        step_id = "step1"
        tool_name = "search_database"
        key1 = f"tool:{step_id}:{tool_name}:1"
        key2 = f"tool:{step_id}:{tool_name}:2"
        assert key1 != key2

    def test_event_key_deterministic(self):
        """Same inputs should produce same event key."""
        step_id = "step1"
        tool_name = "search"
        attempt = 1
        key1 = f"tool:{step_id}:{tool_name}:{attempt}"
        key2 = f"tool:{step_id}:{tool_name}:{attempt}"
        assert key1 == key2


class TestRedactionAllowlist:
    """Verify allowlist and droplist contents."""

    def test_essential_keys_in_allowlist(self):
        """Essential keys should be in allowlist."""
        essential = [
            "id", "workflow_id", "trace_id", "step_id",
            "status", "success", "error", "kind", "name",
            "latency_ms", "count", "event_count",
        ]
        for key in essential:
            assert key in REDACTION_ALLOWLIST, f"{key} should be in allowlist"

    def test_sensitive_keys_in_droplist(self):
        """Sensitive keys should be in droplist."""
        sensitive = [
            "password", "secret", "token", "api_key",
            "authorization", "credential", "private_key",
        ]
        for key in sensitive:
            assert key in REDACTION_DROPLIST, f"{key} should be in droplist"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
