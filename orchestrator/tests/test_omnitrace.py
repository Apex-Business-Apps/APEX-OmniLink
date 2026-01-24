"""Tests for the OmniTrace observability module."""

from __future__ import annotations

from observability.omnitrace import (
    ALLOWLIST_KEYS,
    DROPLIST_KEYS,
    canonical_json,
    compute_hash,
    event_key,
    redact_dict,
    truncate_payload,
)


class TestCanonicalJson:
    """Tests for canonical JSON serialization."""

    def test_sorted_keys(self):
        """Keys should be sorted alphabetically."""
        data = {"zebra": 1, "apple": 2, "mango": 3}
        result = canonical_json(data)
        assert result == '{"apple":2,"mango":3,"zebra":1}'

    def test_no_whitespace(self):
        """Output should have no extra whitespace."""
        data = {"key": "value", "nested": {"inner": 1}}
        result = canonical_json(data)
        assert " " not in result
        assert "\n" not in result

    def test_deterministic(self):
        """Same input should always produce same output."""
        data = {"b": 2, "a": 1}
        results = [canonical_json(data) for _ in range(10)]
        assert len(set(results)) == 1


class TestComputeHash:
    """Tests for content-based hashing."""

    def test_hash_stability(self):
        """Same input should produce same hash."""
        data = {"key": "value"}
        hash1 = compute_hash(data)
        hash2 = compute_hash(data)
        assert hash1 == hash2

    def test_hash_different_for_different_input(self):
        """Different inputs should produce different hashes."""
        data1 = {"key": "value1"}
        data2 = {"key": "value2"}
        assert compute_hash(data1) != compute_hash(data2)

    def test_hash_length(self):
        """Hash should be the specified length."""
        data = {"key": "value"}
        assert len(compute_hash(data)) == 16
        assert len(compute_hash(data, length=8)) == 8
        assert len(compute_hash(data, length=32)) == 32

    def test_hash_order_independent(self):
        """Hash should be independent of key order in input dict."""
        data1 = {"a": 1, "b": 2}
        data2 = {"b": 2, "a": 1}
        assert compute_hash(data1) == compute_hash(data2)


class TestRedaction:
    """Tests for sensitive data redaction."""

    def test_allowlisted_keys_preserved(self):
        """Allowlisted keys should be preserved."""
        data = {
            "id": "test-id-12345",
            "workflow_id": "wf-abc-123",
            "status": "completed",
        }
        result = redact_dict(data)
        assert result["id"] == "test-id-12345"
        assert result["workflow_id"] == "wf-abc-123"
        assert result["status"] == "completed"

    def test_sensitive_keys_dropped(self):
        """Sensitive keys should be redacted."""
        data = {
            "id": "test",
            "password": "super-secret",
            "api_key": "key-12345",
            "token": "bearer-xyz",
        }
        result = redact_dict(data)
        assert result["id"] == "test"
        assert "<redacted:" in str(result.get("password", ""))
        assert "<redacted:" in str(result.get("api_key", ""))
        assert "<redacted:" in str(result.get("token", ""))

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
        """Nested dictionaries should be recursively redacted."""
        data = {
            "id": "test",
            "nested": {
                "password": "secret",
                "safe_key": "short",
            },
        }
        result = redact_dict(data)
        assert result["id"] == "test"
        assert "<redacted:" in str(result["nested"].get("password", ""))
        assert result["nested"]["safe_key"] == "short"

    def test_small_numbers_preserved(self):
        """Small numbers should be preserved."""
        data = {
            "id": "test",
            "count": 42,
            "score": 99.5,
        }
        result = redact_dict(data)
        assert result["count"] == 42
        assert abs(result["score"] - 99.5) < 0.01  # Avoid direct float equality

    def test_large_numbers_hashed(self):
        """Large numbers should be hashed."""
        data = {
            "id": "test",
            "account_number": 1234567890123456,
            "large_amount": 999999999,
        }
        result = redact_dict(data)
        assert result["id"] == "test"
        assert "<redacted:" in str(result.get("account_number", ""))
        assert "<redacted:" in str(result.get("large_amount", ""))


class TestPayloadTruncation:
    """Tests for payload truncation."""

    def test_small_payload_unchanged(self):
        """Small payloads should not be truncated."""
        payload = {
            "id": "test",
            "workflow_id": "wf-123",
            "data": "small",
        }
        result = truncate_payload(payload)
        assert result == payload

    def test_large_payload_truncated(self):
        """Large payloads should be truncated."""
        payload = {
            "id": "test",
            "workflow_id": "wf-123",
            "event_type": "test_event",
            "large_data": "x" * 100000,
        }
        result = truncate_payload(payload, max_size=1000)
        assert "<truncated>" in result
        assert result["<truncated>"] is True
        assert "original_size" in result

    def test_truncated_preserves_workflow_id(self):
        """Truncated payloads should preserve workflow_id."""
        payload = {
            "workflow_id": "wf-important-123",
            "id": "event-456",
            "event_type": "test_event",
            "large_data": "x" * 100000,
        }
        result = truncate_payload(payload, max_size=1000)
        assert result["workflow_id"] == "wf-important-123"
        assert result["id"] == "event-456"
        assert result["event_type"] == "test_event"


class TestEventKeyUniqueness:
    """Tests for event key generation."""

    def test_event_key_format(self):
        """Event keys should have the expected format."""
        key = event_key(
            workflow_id="wf-12345678-abcd",
            event_type="tool_call",
            step="step_1",
        )
        assert key.startswith("tool_call:")
        assert ":" in key

    def test_event_key_different_for_retries(self):
        """Different retry counts should produce different keys."""
        key1 = event_key(
            workflow_id="wf-123",
            event_type="tool_call",
            step="step_1",
            retry_count=0,
        )
        key2 = event_key(
            workflow_id="wf-123",
            event_type="tool_call",
            step="step_1",
            retry_count=1,
        )
        assert key1 != key2

    def test_event_key_deterministic(self):
        """Same inputs should produce same event key."""
        kwargs = {
            "workflow_id": "wf-123",
            "event_type": "tool_call",
            "step": "step_1",
            "retry_count": 0,
        }
        key1 = event_key(**kwargs)
        key2 = event_key(**kwargs)
        assert key1 == key2


class TestRedactionAllowlist:
    """Tests for redaction allowlist and droplist configuration."""

    def test_essential_keys_in_allowlist(self):
        """Essential tracing keys should be in the allowlist."""
        essential = {"id", "workflow_id", "event_type", "status", "timestamp"}
        for key in essential:
            assert key in ALLOWLIST_KEYS, f"{key} should be in allowlist"

    def test_sensitive_keys_in_droplist(self):
        """Sensitive keys should be in the droplist."""
        sensitive = {"password", "secret", "token", "api_key"}
        for key in sensitive:
            assert key in DROPLIST_KEYS, f"{key} should be in droplist"
