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
            "transfer_funds", "delete_record", "send_email"
        }

    def triage_intent(self, intent: ActionIntent) -> RiskTriageResult:
        """
        Triage an action intent and return risk assessment.

        Args:
            intent: The action intent to evaluate

        Returns:
            RiskTriageResult with lane and reason
        """
        # Check for irreversible actions first
        if intent.irreversible:
            return RiskTriageResult(
                lane=ManLane.RED,
                reason="irreversible action"
            )

        # Check for sensitive tools
        if intent.tool_name in self.sensitive_tools:
            return RiskTriageResult(
                lane=ManLane.RED,
                reason=f"sensitive tool: {intent.tool_name}"
            )

        # Default to green for low-risk actions
        return RiskTriageResult(
            lane=ManLane.GREEN,
            reason="low risk action"
        )

    def triage_intent_payload(
        self, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Triage an action intent from a plain dict payload.

        Args:
            payload: Dict containing ActionIntent fields

        Returns:
            Dict with RiskTriageResult fields
        """
        intent = ActionIntent(**payload)
        result = self.triage_intent(intent)
        return result.model_dump()