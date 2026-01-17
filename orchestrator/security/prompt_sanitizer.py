"""
Prompt Security: Sanitization and Injection Prevention.

This module provides defense-in-depth against prompt injection attacks
by sanitizing user inputs before they reach the LLM.

CVE Remediation: User-supplied goals and context were previously
interpolated directly into LLM prompts, allowing manipulation.
"""

import re
from typing import Any

# Patterns that indicate potential prompt injection attempts
INJECTION_PATTERNS = [
    # Direct instruction override
    r"ignore\s+(previous|all|your)\s+(instructions?|prompts?|rules?)",
    r"disregard\s+(previous|all|your)\s+(instructions?|prompts?|rules?)",
    r"forget\s+(everything|all)\s+(above|before|previous)",
    # Role manipulation
    r"you\s+are\s+now\s+(a|an)?\s*\w+",
    r"act\s+as\s+(if\s+)?(you\s+are\s+)?(a|an)?\s*\w+",
    r"pretend\s+(to\s+be|you\s+are)",
    r"roleplay\s+as",
    # System prompt extraction
    r"reveal\s+(your\s+)?(system\s+)?prompt",
    r"show\s+(me\s+)?(your\s+)?instructions",
    r"what\s+(are\s+)?(your\s+)?rules",
    # Jailbreak attempts
    r"jailbreak",
    r"dan\s+mode",
    r"developer\s+mode",
    r"sudo\s+(mode|access)",
    r"admin\s+(mode|access)",
    r"bypass\s+(filters?|restrictions?|safety)",
    r"escape\s+(sandbox|restrictions?)",
    # Encoding tricks
    r"\[system\]",
    r"\[instruction\]",
    r"\{inject\}",
    r"<<\s*[a-z]+\s*>>",
    # Override markers
    r"override:?\s",
    r"new\s+instructions?:?\s",
    r"updated\s+prompt:?\s",
    # Hypothetical framing (often used to bypass filters)
    r"hypothetically\s+(speaking\s+)?(without|if)",
    r"in\s+a\s+fictional\s+(world|scenario)",
    r"for\s+educational\s+purposes?\s+(only\s+)?(show|tell|explain)",
    r"as\s+an\s+experiment",
]

# Compiled patterns for performance
_COMPILED_PATTERNS = [re.compile(pattern, re.IGNORECASE) for pattern in INJECTION_PATTERNS]


class PromptInjectionDetectedError(Exception):
    """Raised when prompt injection is detected in user input."""

    def __init__(self, message: str, pattern: str, input_text: str):
        super().__init__(message)
        self.pattern = pattern
        self.input_text = input_text[:100]  # Truncate for logging safety


def detect_injection(text: str) -> tuple[bool, str | None]:
    """
    Detect potential prompt injection in text.

    Args:
        text: User-supplied text to check

    Returns:
        Tuple of (is_injection, matched_pattern)
    """
    for i, pattern in enumerate(_COMPILED_PATTERNS):
        if pattern.search(text):
            return True, INJECTION_PATTERNS[i]
    return False, None


def sanitize_for_prompt(text: str, field_name: str = "input") -> str:
    """
    Sanitize user input for safe inclusion in LLM prompts.

    This function:
    1. Detects and blocks known injection patterns
    2. Escapes special characters that could be misinterpreted
    3. Truncates overly long inputs
    4. Normalizes whitespace

    Args:
        text: User-supplied text to sanitize
        field_name: Name of the field (for error messages)

    Returns:
        Sanitized text safe for prompt inclusion

    Raises:
        PromptInjectionDetected: If injection attempt is detected
    """
    if not text:
        return ""

    # Check for injection patterns
    is_injection, pattern = detect_injection(text)
    if is_injection:
        raise PromptInjectionDetectedError(
            f"Potential prompt injection detected in {field_name}", pattern=pattern, input_text=text
        )

    # Normalize whitespace
    sanitized = " ".join(text.split())

    # Escape characters that could be used for injection
    sanitized = sanitized.replace("\\", "\\\\")  # Escape backslashes first
    sanitized = sanitized.replace('"', '\\"')  # Escape quotes
    sanitized = sanitized.replace("{{", "{ {")  # Break template markers
    sanitized = sanitized.replace("}}", "} }")
    sanitized = sanitized.replace("[[", "[ [")  # Break bracket markers
    sanitized = sanitized.replace("]]", "] ]")

    # Truncate to prevent context overflow attacks
    max_length = 2000
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length] + "... [truncated]"

    return sanitized


def sanitize_context(context: dict[str, Any], max_depth: int = 3) -> dict[str, Any]:
    """
    Recursively sanitize a context dictionary.

    Args:
        context: Dictionary of context values
        max_depth: Maximum nesting depth (prevents deep injection)

    Returns:
        Sanitized context dictionary
    """
    if max_depth <= 0:
        return {"_truncated": "max depth exceeded"}

    sanitized = {}

    for key, value in context.items():
        # Sanitize key
        safe_key = sanitize_for_prompt(str(key), f"context_key:{key}")

        # Sanitize value based on type
        if isinstance(value, str):
            safe_value = sanitize_for_prompt(value, f"context:{key}")
        elif isinstance(value, dict):
            safe_value = sanitize_context(value, max_depth - 1)
        elif isinstance(value, list):
            safe_value = [
                (
                    sanitize_for_prompt(str(item), f"context:{key}[{i}]")
                    if isinstance(item, str)
                    else item
                )
                for i, item in enumerate(value[:100])  # Limit list size
            ]
        else:
            # Numbers, booleans, None - safe as-is
            safe_value = value

        sanitized[safe_key] = safe_value

    return sanitized


def create_safe_user_message(goal: str, context: dict[str, Any]) -> str:
    """
    Create a safe user message for LLM prompts.

    This is the main entry point for sanitizing user input before
    including it in prompts.

    Args:
        goal: User's natural language goal
        context: Additional context dictionary

    Returns:
        Sanitized message string safe for prompt inclusion
    """
    import json

    safe_goal = sanitize_for_prompt(goal, "goal")
    safe_context = sanitize_context(context)

    # Use a structured format that's harder to manipulate
    return f"""USER REQUEST:
---
Goal: {safe_goal}
---
Context: {json.dumps(safe_context, indent=2)}
---
Generate a plan for the above goal."""
