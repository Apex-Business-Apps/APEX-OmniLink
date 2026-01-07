"""
Unit tests for MAN Mode Temporal activities.

Tests the activities for risk triage, task creation, resolution, and backlog checking.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from orchestrator.activities.man_mode import (
    backlog_check,
    create_man_task,
    resolve_man_task,
    risk_triage,
)
from orchestrator.models.man_mode import (
    ManLane,
    RiskTriageResult,
)


class TestRiskTriageActivity:
    """Test risk_triage activity."""

    @pytest.mark.asyncio
    async def test_successful_triage_red_lane(self):
        """Test successful triage resulting in RED lane."""
        intent_data = {
            "tenant_id": "tenant1",
            "workflow_id": "wf1",
            "run_id": "run1",
            "step_id": "step1",
            "tool_name": "send_email",
            "tool_params": {"to": "test@example.com"},
            "flags": {"irreversible": True}
        }

        with patch("orchestrator.activities.man_mode.get_policy_engine") as mock_get_engine:
            mock_engine = MagicMock()
            mock_result = RiskTriageResult(
                lane=ManLane.RED,
                risk_score=0.85,
                reasons=["irreversible: 0.80"]
            )
            mock_engine.triage_intent.return_value = mock_result
            mock_get_engine.return_value = mock_engine

            result = await risk_triage(intent_data)

            assert result["lane"] == "RED"
            assert result["risk_score"] == 0.85
            assert "irreversible: 0.80" in result["reasons"]

            mock_engine.triage_intent.assert_called_once()

    @pytest.mark.asyncio
    async def test_triage_with_workflow_key(self):
        """Test triage with workflow-specific policy."""
        intent_data = {
            "tenant_id": "tenant1",
            "workflow_id": "wf1",
            "run_id": "run1",
            "step_id": "step1",
            "tool_name": "send_email",
            "tool_params": {"to": "test@example.com"},
        }

        workflow_key = "special_workflow"
        free_text_signals = ["urgent", "critical"]

        with patch("orchestrator.activities.man_mode.get_policy_engine") as mock_get_engine:
            mock_engine = MagicMock()
            mock_result = RiskTriageResult(
                lane=ManLane.GREEN,
                risk_score=0.1,
                reasons=[]
            )
            mock_engine.triage_intent.return_value = mock_result
            mock_get_engine.return_value = mock_engine

            await risk_triage(intent_data, workflow_key, free_text_signals)

            mock_engine.triage_intent.assert_called_once()
            args, kwargs = mock_engine.triage_intent.call_args
            assert kwargs["workflow_key"] == workflow_key
            assert kwargs["free_text_signals"] == free_text_signals


class TestCreateManTaskActivity:
    """Test create_man_task activity."""

    @pytest.mark.asyncio
    async def test_create_task_red_lane(self):
        """Test task creation for RED lane triage result."""
        intent_data = {
            "tenant_id": "tenant1",
            "workflow_id": "wf1",
            "run_id": "run1",
            "step_id": "step1",
            "tool_name": "delete_user",
            "tool_params": {"user_id": "123"},
            "flags": {"irreversible": True}
        }

        triage_data = {
            "lane": "RED",
            "risk_score": 0.9,
            "reasons": ["irreversible: 0.80", "affects_rights: 1.00"]
        }

        expected_task = {
            "id": "task-123",
            "tenant_id": "tenant1",
            "workflow_id": "wf1",
            "run_id": "run1",
            "step_id": "step1",
            "tool_name": "delete_user",
            "status": "PENDING",
            "risk_score": 0.9,
            "risk_reasons": ["irreversible: 0.80", "affects_rights: 1.00"],
        }

        with patch("orchestrator.activities.man_mode.get_database_provider") as mock_get_db:
            mock_db = AsyncMock()
            mock_db.upsert.return_value = expected_task
            mock_get_db.return_value = mock_db

            result = await create_man_task(intent_data, triage_data)

            assert result == expected_task
            mock_db.upsert.assert_called_once()

            # Verify upsert was called with correct conflict column
            call_args = mock_db.upsert.call_args
            assert "idempotency_key" in call_args[1]["conflict_columns"]

    @pytest.mark.asyncio
    async def test_skip_task_non_red_lane(self):
        """Test that tasks are not created for non-RED lanes."""
        intent_data = {
            "tenant_id": "tenant1",
            "workflow_id": "wf1",
            "run_id": "run1",
            "step_id": "step1",
            "tool_name": "search_database",
            "tool_params": {"table": "users"},
        }

        triage_data = {
            "lane": "GREEN",
            "risk_score": 0.1,
            "reasons": []
        }

        result = await create_man_task(intent_data, triage_data)

        assert result is None

    @pytest.mark.asyncio
    async def test_idempotency_key_deterministic(self):
        """Test that idempotency keys are deterministic for same inputs."""
        intent_data = {
            "tenant_id": "tenant1",
            "workflow_id": "wf1",
            "run_id": "run1",
            "step_id": "step1",
            "tool_name": "send_email",
            "tool_params": {"to": "test@example.com", "subject": "Test"},
        }

        triage_data = {"lane": "RED", "risk_score": 0.8, "reasons": []}

        # Create two tasks with identical inputs
        with patch("orchestrator.activities.man_mode.get_database_provider") as mock_get_db:
            mock_db = AsyncMock()
            mock_db.upsert.return_value = {"id": "task-123"}
            mock_get_db.return_value = mock_db

            await create_man_task(intent_data, triage_data)
            await create_man_task(intent_data, triage_data)

            # Should have been called twice with same idempotency key
            assert mock_db.upsert.call_count == 2

            call1 = mock_db.upsert.call_args_list[0]
            call2 = mock_db.upsert.call_args_list[1]

            # Same idempotency key should be used
            key1 = call1[1]["record"]["idempotency_key"]
            key2 = call2[1]["record"]["idempotency_key"]
            assert key1 == key2


class TestResolveManTaskActivity:
    """Test resolve_man_task activity."""

    @pytest.mark.asyncio
    async def test_successful_resolution_approve(self):
        """Test successful task resolution with APPROVE decision."""
        task_id = "task-123"
        decision_data = {
            "decision": "APPROVE",
            "reason": "Safe operation",
            "reviewer_id": "reviewer1",
            "modified_params": None
        }

        existing_task = {"id": task_id, "status": "PENDING"}
        updated_task = {
            "id": task_id,
            "status": "APPROVED",
            "reviewer_id": "reviewer1",
            "decision": decision_data
        }

        with patch("orchestrator.activities.man_mode.get_database_provider") as mock_get_db:
            mock_db = AsyncMock()
            mock_db.select_one.side_effect = [existing_task, updated_task]  # First call returns existing, second returns updated
            mock_db.update.return_value = updated_task
            mock_get_db.return_value = mock_db

            result = await resolve_man_task(task_id, decision_data)

            assert result["status"] == "APPROVED"
            assert result["reviewer_id"] == "reviewer1"

            mock_db.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_idempotent_already_resolved(self):
        """Test idempotent behavior when task already resolved."""
        task_id = "task-123"
        decision_data = {
            "decision": "APPROVE",
            "reason": "Safe operation",
            "reviewer_id": "reviewer1"
        }

        resolved_task = {
            "id": task_id,
            "status": "APPROVED",
            "reviewer_id": "reviewer1",
            "decision": {"decision": "APPROVE"}
        }

        with patch("orchestrator.activities.man_mode.get_database_provider") as mock_get_db:
            mock_db = AsyncMock()
            mock_db.select_one.return_value = resolved_task
            mock_get_db.return_value = mock_db

            result = await resolve_man_task(task_id, decision_data)

            assert result["status"] == "APPROVED"
            # Should not attempt update for already resolved task
            mock_db.update.assert_not_called()

    @pytest.mark.asyncio
    async def test_task_not_found(self):
        """Test handling of non-existent task."""
        task_id = "nonexistent"
        decision_data = {
            "decision": "APPROVE",
            "reason": "Safe operation",
            "reviewer_id": "reviewer1"
        }

        with patch("orchestrator.activities.man_mode.get_database_provider") as mock_get_db:
            mock_db = AsyncMock()
            mock_db.select_one.return_value = None
            mock_get_db.return_value = mock_db

            with pytest.raises(Exception, match="MAN task nonexistent not found"):
                await resolve_man_task(task_id, decision_data)

    @pytest.mark.asyncio
    async def test_concurrent_resolution(self):
        """Test handling of concurrent task resolution."""
        task_id = "task-123"
        decision_data = {
            "decision": "APPROVE",
            "reason": "Safe operation",
            "reviewer_id": "reviewer1"
        }

        existing_task = {"id": task_id, "status": "PENDING"}
        resolved_task = {"id": task_id, "status": "APPROVED"}  # Already resolved by another process

        with patch("orchestrator.activities.man_mode.get_database_provider") as mock_get_db:
            mock_db = AsyncMock()
            mock_db.select_one.side_effect = [existing_task, resolved_task]
            mock_db.update.return_value = None  # Update returns None (no rows affected)
            mock_get_db.return_value = mock_db

            result = await resolve_man_task(task_id, decision_data)

            assert result["status"] == "APPROVED"
            # Should return the already resolved task


class TestBacklogCheckActivity:
    """Test backlog_check activity."""

    @pytest.mark.asyncio
    async def test_normal_backlog(self):
        """Test backlog check with normal load."""
        tenant_id = "tenant1"

        with patch("orchestrator.activities.man_mode.get_policy_engine") as mock_get_engine, \
             patch("orchestrator.activities.man_mode.get_database_provider") as mock_get_db:

            # Mock policy
            mock_policy = MagicMock()
            mock_policy.max_pending_per_tenant = 50
            mock_policy.degrade_behavior = "BLOCK_NEW"

            mock_engine = MagicMock()
            mock_engine.policy = mock_policy
            mock_get_engine.return_value = mock_engine

            # Mock database - 10 pending tasks
            mock_db = AsyncMock()
            mock_db.select.return_value = [{"id": f"task-{i}"} for i in range(10)]
            mock_get_db.return_value = mock_db

            result = await backlog_check(tenant_id)

            assert result["overloaded"] is False
            assert result["pending_count"] == 10
            assert result["max_pending"] == 50
            assert result["action"] is None

    @pytest.mark.asyncio
    async def test_overloaded_backlog(self):
        """Test backlog check with overloaded tenant."""
        tenant_id = "tenant1"

        with patch("orchestrator.activities.man_mode.get_policy_engine") as mock_get_engine, \
             patch("orchestrator.activities.man_mode.get_database_provider") as mock_get_db:

            # Mock policy
            mock_policy = MagicMock()
            mock_policy.max_pending_per_tenant = 10
            mock_policy.degrade_behavior = "FORCE_PAUSE"

            mock_engine = MagicMock()
            mock_engine.policy = mock_policy
            mock_get_engine.return_value = mock_engine

            # Mock database - 15 pending tasks (overloaded)
            mock_db = AsyncMock()
            mock_db.select.return_value = [{"id": f"task-{i}"} for i in range(15)]
            mock_get_db.return_value = mock_db

            result = await backlog_check(tenant_id)

            assert result["overloaded"] is True
            assert result["pending_count"] == 15
            assert result["max_pending"] == 10
            assert result["action"] == "FORCE_PAUSE"

    @pytest.mark.asyncio
    async def test_backlog_check_failure_safe_defaults(self):
        """Test that backlog check failures return safe defaults."""
        tenant_id = "tenant1"

        with patch("orchestrator.activities.man_mode.get_policy_engine") as mock_get_engine:
            mock_get_engine.side_effect = Exception("Policy engine error")

            result = await backlog_check(tenant_id)

            # Should return safe defaults
            assert result["overloaded"] is False
            assert result["pending_count"] == 0
            assert result["max_pending"] == 50
            assert result["action"] is None
            assert "error" in result
