from typing import Any, Dict

from models.man_mode import ManLane, RiskTriageResult


class ManPolicy:
    """Deterministic Policy Engine for MAN Mode."""

    # Keywords that trigger immediate RED lane
    CRITICAL_KEYWORDS = {
        "delete",
        "drop",
        "truncate",
        "transfer",
        "pay",
        "grant",
        "revoke",
        "shutdown",
        "terminate",
        "wipe",
        "format",
        "secret",
        "key",
        "token",
    }

    # High-impact tools that require supervision
    SENSITIVE_TOOLS = {"delete_record", "send_payment", "execute_sql", "deploy_contract"}

    @classmethod
    def triage(cls, tool_name: str, tool_input: Dict[str, Any]) -> RiskTriageResult:
        """Evaluate risk for a specific tool execution."""
        reasons = []
        risk_score = 0.0

        # Check Tool Sensitivity
        if tool_name in cls.SENSITIVE_TOOLS:
            reasons.append(f"Tool '{tool_name}' is classified as SENSITIVE.")
            risk_score += 0.8

        # Check Input Keywords (Heuristic)
        input_str = str(tool_input).lower()
        found_keywords = [kw for kw in cls.CRITICAL_KEYWORDS if kw in input_str]

        if found_keywords:
            reasons.append(f"Detected critical keywords: {', '.join(found_keywords)}")
            risk_score += 0.5

        # Determine Lane
        if risk_score >= 0.8:
            lane = ManLane.RED
        elif risk_score >= 0.4:
            lane = ManLane.YELLOW
        else:
            lane = ManLane.GREEN

        return RiskTriageResult(lane=lane, risk_score=min(risk_score, 1.0), reasons=reasons)
