"""
Policy engine for Manual Assistance Needed (MAN) mode.

Provides risk assessment and triage logic for actions requiring human review.
"""

from ..models.man_mode import ActionIntent, ManLane, RiskTriageResult


class ManPolicy:
    """
    Policy engine for triaging action intents in MAN mode.

    Assesses risk levels and determines if manual approval is required.
    """

    def __init__(self):
        """Initialize policy with default sensitive tools list."""
        self.sensitive_tools = {
            "delete_record",
            "send_email",
            "update_user",
            "create_user",
            "delete_user",
        }

    def triage_intent(self, intent: ActionIntent) -> RiskTriageResult:
        """
        Triage an action intent and return risk assessment.

        Args:
            intent: The action intent to evaluate

        Returns:
            RiskTriageResult with lane, score, and reasons
        """
        reasons = []

        # Check for irreversible actions
        if intent.flags.get("irreversible"):
            reasons.append("irreversible_action")

        # Check for sensitive tools
        if intent.tool_name in self.sensitive_tools:
            reasons.append(f"sensitive_tool: {intent.tool_name}")

        # Determine lane based on rules
        if intent.flags.get("irreversible") or intent.tool_name in self.sensitive_tools:
            lane = ManLane.RED
            risk_score = 0.9
        else:
            lane = ManLane.GREEN
            risk_score = 0.1

        return RiskTriageResult(
            lane=lane,
            risk_score=risk_score,
            reasons=reasons
        )
