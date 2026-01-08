"""
MAN Mode Policy Engine - Stateless risk classification.

This module contains pure policy logic for classifying agent actions.
No database access, no I/O - only decision logic.

Design Principles:
1. Pure functions (no side effects)
2. Deterministic (same input = same output)
3. Easily testable (no mocks needed)
4. Extensible (subclass for custom policies)
"""

from typing import Any

from ..models.man_mode import ActionIntent, ManLane, RiskTriageResult

# ============================================================================
# SENSITIVE TOOLS CONFIGURATION
# ============================================================================

# Tools that require human approval (RED lane)
SENSITIVE_TOOLS: set[str] = {
    # Financial operations
    "transfer_funds",
    "process_payment",
    "refund_payment",
    "update_billing",
    "modify_subscription",
    # Data deletion
    "delete_record",
    "delete_user",
    "purge_data",
    "truncate_table",
    "drop_table",
    # Account operations
    "deactivate_account",
    "suspend_user",
    "revoke_access",
    "reset_credentials",
    "change_permissions",
    # System operations
    "modify_config",
    "update_secrets",
    "deploy_code",
    "rollback_deployment",
    "restart_service",
    # Communication (irreversible)
    "send_email",
    "send_sms",
    "send_notification",
    "broadcast_message",
    # External integrations
    "webhook_external",
    "api_call_external",
    "publish_event",
}

# Tools that are always blocked (BLOCKED lane)
BLOCKED_TOOLS: set[str] = {
    "execute_sql_raw",
    "shell_execute",
    "file_system_write",
    "admin_override",
}

# Tools that are always safe (GREEN lane)
SAFE_TOOLS: set[str] = {
    "search_database",
    "read_record",
    "get_config",
    "list_users",
    "check_status",
    "validate_input",
    "check_semantic_cache",
    "read_data",
}

# Parameter patterns that elevate risk
HIGH_RISK_PARAMS: dict[str, list[str]] = {
    "amount": ["10000", "50000", "100000"],  # Large financial amounts
    "scope": ["all", "global", "system"],  # Broad scope operations
    "force": ["true", "True", "1"],  # Force flags
    "cascade": ["true", "True", "1"],  # Cascade deletions
    "admin": ["true", "True", "1"],  # Admin operations
}


# ============================================================================
# POLICY ENGINE
# ============================================================================


class ManPolicy:
    """
    Risk classification policy for agent actions.

    Evaluates ActionIntent and returns RiskTriageResult with:
    - Lane classification (GREEN/YELLOW/RED/BLOCKED)
    - Human-readable reason
    - Risk factors that contributed to classification

    Usage:
        policy = ManPolicy()
        result = policy.triage(intent)
        if result.requires_approval:
            # Create MAN task and pause workflow
            pass
    """

    def __init__(
        self,
        sensitive_tools: set[str] | None = None,
        blocked_tools: set[str] | None = None,
        safe_tools: set[str] | None = None,
    ) -> None:
        """
        Initialize policy with optional custom tool sets.

        Args:
            sensitive_tools: Override default sensitive tools (RED lane)
            blocked_tools: Override default blocked tools (BLOCKED lane)
            safe_tools: Override default safe tools (GREEN lane)
        """
        self.sensitive_tools = sensitive_tools or SENSITIVE_TOOLS
        self.blocked_tools = blocked_tools or BLOCKED_TOOLS
        self.safe_tools = safe_tools or SAFE_TOOLS

    def triage(self, intent: ActionIntent) -> RiskTriageResult:
        """
        Classify risk level of an agent action.

        Evaluation order:
        1. Check if tool is explicitly blocked → BLOCKED
        2. Check if tool is in sensitive list → RED
        3. Check if marked irreversible → RED
        4. Check for high-risk parameters → RED or YELLOW
        5. Check if tool is in safe list → GREEN
        6. Default → YELLOW (unknown tools get logged)

        Args:
            intent: The action to evaluate

        Returns:
            RiskTriageResult with classification details
        """
        tool_name = intent.tool_name.lower()
        risk_factors: list[str] = []

        # 1. BLOCKED lane: prohibited tools
        if tool_name in {t.lower() for t in self.blocked_tools}:
            return RiskTriageResult(
                lane=ManLane.BLOCKED,
                reason=f"Tool '{intent.tool_name}' is prohibited",
                requires_approval=False,  # Never execute, no point in approval
                risk_factors=["blocked_tool"],
            )

        # 2. RED lane: sensitive tools
        if tool_name in {t.lower() for t in self.sensitive_tools}:
            risk_factors.append("sensitive_tool")
            return RiskTriageResult(
                lane=ManLane.RED,
                reason=f"Tool '{intent.tool_name}' requires human approval",
                requires_approval=True,
                risk_factors=risk_factors,
                suggested_timeout_hours=24,
            )

        # 3. RED lane: explicitly marked irreversible
        if intent.irreversible:
            risk_factors.append("marked_irreversible")
            return RiskTriageResult(
                lane=ManLane.RED,
                reason="Action is marked as irreversible",
                requires_approval=True,
                risk_factors=risk_factors,
                suggested_timeout_hours=24,
            )

        # 4. Check for high-risk parameters
        param_risk = self._evaluate_params(intent.params)
        risk_factors.extend(param_risk)

        if len(param_risk) >= 2:
            # Multiple high-risk params → RED
            return RiskTriageResult(
                lane=ManLane.RED,
                reason="Multiple high-risk parameters detected",
                requires_approval=True,
                risk_factors=risk_factors,
                suggested_timeout_hours=24,
            )
        elif len(param_risk) == 1:
            # Single high-risk param → YELLOW (logged but auto-execute)
            return RiskTriageResult(
                lane=ManLane.YELLOW,
                reason=f"High-risk parameter detected: {param_risk[0]}",
                requires_approval=False,
                risk_factors=risk_factors,
            )

        # 5. GREEN lane: explicitly safe tools
        if tool_name in {t.lower() for t in self.safe_tools}:
            return RiskTriageResult(
                lane=ManLane.GREEN,
                reason="Tool is classified as safe",
                requires_approval=False,
                risk_factors=[],
            )

        # 6. Default: YELLOW (unknown tools - log but execute)
        return RiskTriageResult(
            lane=ManLane.YELLOW,
            reason="Unknown tool - executing with audit logging",
            requires_approval=False,
            risk_factors=["unknown_tool"],
        )

    def _evaluate_params(self, params: dict[str, Any]) -> list[str]:
        """
        Evaluate parameters for high-risk patterns.

        Returns list of risk factor strings for matching patterns.
        """
        risk_factors: list[str] = []

        for param_name, risky_values in HIGH_RISK_PARAMS.items():
            if param_name in params:
                param_value = str(params[param_name])
                if param_value in risky_values:
                    risk_factors.append(f"high_risk_param:{param_name}={param_value}")

        # Check for large numeric amounts (financial risk)
        for param_name in ["amount", "value", "quantity"]:
            if param_name in params:
                try:
                    amount = float(params[param_name])
                    if amount >= 10000:
                        risk_factors.append(f"large_amount:{param_name}={amount}")
                except (ValueError, TypeError):
                    pass

        return risk_factors

    def is_sensitive(self, tool_name: str) -> bool:
        """Check if a tool is in the sensitive list."""
        return tool_name.lower() in {t.lower() for t in self.sensitive_tools}

    def is_blocked(self, tool_name: str) -> bool:
        """Check if a tool is in the blocked list."""
        return tool_name.lower() in {t.lower() for t in self.blocked_tools}

    def is_safe(self, tool_name: str) -> bool:
        """Check if a tool is in the safe list."""
        return tool_name.lower() in {t.lower() for t in self.safe_tools}
