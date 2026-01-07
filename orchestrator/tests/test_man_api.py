"""
Unit tests for MAN Mode API endpoints.

Tests the FastAPI endpoints for operator interaction with MAN Mode.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from orchestrator.main import app


class TestManModeAPI:
    """Test MAN Mode API endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client for FastAPI app."""
        return TestClient(app)

    @pytest.fixture
    def mock_db(self):
        """Mock database provider."""
        mock_db = AsyncMock()
        mock_db.select.return_value = []
        mock_db.select_one.return_value = None
        mock_db.upsert.return_value = {"id": "test-policy-id"}
        return mock_db

    @pytest.fixture
    def mock_temporal_client(self):
        """Mock Temporal client."""
        mock_client = AsyncMock()
        mock_handle = AsyncMock()
        mock_client.get_workflow_handle.return_value = mock_handle
        return mock_client

    # ============================================================================
    # MAN TASK ENDPOINTS
    # ============================================================================

    @patch("orchestrator.main.get_database_provider")
    def test_list_man_tasks_success(self, mock_get_db_provider, client, mock_db):
        """Test successful listing of MAN tasks."""
        mock_get_db_provider.return_value = mock_db
        mock_db.select.return_value = [
            {"id": "task1", "status": "PENDING", "tool_name": "send_email"},
            {"id": "task2", "status": "APPROVED", "tool_name": "delete_user"},
        ]

        response = client.get("/api/v1/man/tasks")

        assert response.status_code == 200
        data = response.json()
        assert len(data["tasks"]) == 2
        assert data["total"] == 2
        assert data["tasks"][0]["tool_name"] == "send_email"

    @patch("orchestrator.main.get_database_provider")
    def test_list_man_tasks_with_filters(self, mock_get_db_provider, client, mock_db):
        """Test listing MAN tasks with filters."""
        mock_get_db_provider.return_value = mock_db
        mock_db.select.return_value = [{"id": "task1", "status": "PENDING"}]

        response = client.get("/api/v1/man/tasks?tenant_id=tenant1&status=PENDING")

        assert response.status_code == 200
        mock_db.select.assert_called_once()
        call_args = mock_db.select.call_args
        assert call_args[1]["filters"]["tenant_id"] == "tenant1"
        assert call_args[1]["filters"]["status"] == "PENDING"

    @patch("orchestrator.main.get_database_provider")
    def test_get_man_task_success(self, mock_get_db_provider, client, mock_db):
        """Test successful retrieval of a MAN task."""
        mock_get_db_provider.return_value = mock_db
        mock_db.select_one.return_value = {
            "id": "task1",
            "status": "PENDING",
            "tool_name": "send_email",
        }
        mock_db.select.return_value = []  # No decision events

        response = client.get("/api/v1/man/tasks/task1")

        assert response.status_code == 200
        data = response.json()
        assert data["task"]["id"] == "task1"
        assert data["decision_events"] == []

    @patch("orchestrator.main.get_database_provider")
    def test_get_man_task_not_found(self, mock_get_db_provider, client, mock_db):
        """Test retrieval of non-existent MAN task."""
        mock_get_db_provider.return_value = mock_db
        mock_db.select_one.return_value = None

        response = client.get("/api/v1/man/tasks/nonexistent")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    @patch("orchestrator.main.Client")
    @patch("orchestrator.main.get_database_provider")
    @patch("orchestrator.main.resolve_man_task")
    def test_submit_man_decision_success(
        self,
        mock_resolve_task,
        mock_get_db_provider,
        mock_client_class,
        client,
        mock_db,
        mock_temporal_client,
    ):
        """Test successful submission of MAN decision."""
        mock_get_db_provider.return_value = mock_db
        mock_client_class.connect.return_value = mock_temporal_client
        mock_db.select_one.return_value = {"workflow_id": "wf-123", "tenant_id": "tenant1"}

        decision_data = {
            "decision": "APPROVE",
            "reason": "Safe operation",
            "reviewer_id": "reviewer1",
        }

        response = client.post("/api/v1/man/tasks/task1/decision", json=decision_data)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "decision_submitted"
        assert data["task_id"] == "task1"

        # Verify Temporal update was called
        mock_temporal_client.get_workflow_handle.assert_called_with("wf-123")
        handle = mock_temporal_client.get_workflow_handle.return_value
        handle.execute_update.assert_called_once()

    @patch("orchestrator.main.get_database_provider")
    def test_submit_man_decision_task_not_found(self, mock_get_db_provider, client, mock_db):
        """Test submission of decision for non-existent task."""
        mock_get_db_provider.return_value = mock_db
        mock_db.select_one.return_value = None

        decision_data = {
            "decision": "APPROVE",
            "reason": "Safe operation",
            "reviewer_id": "reviewer1",
        }

        response = client.post("/api/v1/man/tasks/nonexistent/decision", json=decision_data)

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    # ============================================================================
    # POLICY ENDPOINTS
    # ============================================================================

    @patch("orchestrator.main.get_database_provider")
    def test_list_man_policies_success(self, mock_get_db_provider, client, mock_db):
        """Test successful listing of MAN policies."""
        mock_get_db_provider.return_value = mock_db
        mock_db.select.return_value = [
            {"id": "policy1", "tenant_id": None, "workflow_key": None},
            {"id": "policy2", "tenant_id": "tenant1", "workflow_key": "special"},
        ]

        response = client.get("/api/v1/man/policies")

        assert response.status_code == 200
        data = response.json()
        assert len(data["policies"]) == 2

    @patch("orchestrator.main.get_database_provider")
    def test_list_man_policies_with_filters(self, mock_get_db_provider, client, mock_db):
        """Test listing MAN policies with filters."""
        mock_get_db_provider.return_value = mock_db
        mock_db.select.return_value = [{"id": "policy1"}]

        response = client.get("/api/v1/man/policies?tenant_id=tenant1&workflow_key=special")

        assert response.status_code == 200
        mock_db.select.assert_called_once()
        call_args = mock_db.select.call_args
        assert call_args[1]["filters"]["tenant_id"] == "tenant1"
        assert call_args[1]["filters"]["workflow_key"] == "special"

    @patch("orchestrator.main.get_database_provider")
    def test_upsert_man_policy_success(self, mock_get_db_provider, client, mock_db):
        """Test successful upsert of MAN policy."""
        mock_get_db_provider.return_value = mock_db
        mock_db.upsert.return_value = {
            "id": "policy1",
            "tenant_id": "tenant1",
            "workflow_key": "special",
            "policy_json": {"global_thresholds": {"red": 0.8}},
            "version": "1.0",
        }

        policy_data = {
            "global_thresholds": {"red": 0.8, "yellow": 0.5},
            "tool_minimum_lanes": {},
            "hard_triggers": {},
            "per_workflow_overrides": {},
            "max_pending_per_tenant": 50,
            "task_ttl_minutes": 1440,
            "degrade_behavior": "BLOCK_NEW",
        }

        response = client.put(
            "/api/v1/man/policies?tenant_id=tenant1&workflow_key=special&updated_by=admin",
            json=policy_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["policy"]["tenant_id"] == "tenant1"
        assert data["policy"]["workflow_key"] == "special"

    def test_upsert_man_policy_no_policy_data(self, client):
        """Test upsert of MAN policy without policy data."""
        response = client.put("/api/v1/man/policies")

        assert response.status_code == 400
        assert "required" in response.json()["detail"]

    # ============================================================================
    # WORKFLOW CONTROL ENDPOINTS
    # ============================================================================

    @patch("orchestrator.main.Client")
    def test_pause_workflow_success(self, mock_client_class, client, mock_temporal_client):
        """Test successful workflow pause."""
        mock_client_class.connect.return_value = mock_temporal_client

        signal_data = {"workflow_id": "wf-123", "reason": "Operator requested pause"}

        response = client.post("/api/v1/workflows/wf-123/pause", json=signal_data)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "signal_sent"
        assert data["signal"] == "pause"
        assert data["workflow_id"] == "wf-123"

        # Verify signal was sent
        mock_temporal_client.get_workflow_handle.assert_called_with("wf-123")
        handle = mock_temporal_client.get_workflow_handle.return_value
        handle.signal.assert_called_once_with("pause_workflow", "Operator requested pause")

    @patch("orchestrator.main.Client")
    def test_resume_workflow_success(self, mock_client_class, client, mock_temporal_client):
        """Test successful workflow resume."""
        mock_client_class.connect.return_value = mock_temporal_client

        response = client.post("/api/v1/workflows/wf-123/resume")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "signal_sent"
        assert data["signal"] == "resume"

        # Verify signal was sent
        mock_temporal_client.get_workflow_handle.assert_called_with("wf-123")
        handle = mock_temporal_client.get_workflow_handle.return_value
        handle.signal.assert_called_once_with("resume_workflow")

    @patch("orchestrator.main.Client")
    def test_cancel_workflow_success(self, mock_client_class, client, mock_temporal_client):
        """Test successful workflow cancellation."""
        mock_client_class.connect.return_value = mock_temporal_client

        signal_data = {"workflow_id": "wf-123", "reason": "Operator requested cancellation"}

        response = client.post("/api/v1/workflows/wf-123/cancel", json=signal_data)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "signal_sent"
        assert data["signal"] == "cancel"

        # Verify signal was sent
        handle = mock_temporal_client.get_workflow_handle.return_value
        handle.signal.assert_called_once_with("cancel_workflow", "Operator requested cancellation")

    @patch("orchestrator.main.Client")
    def test_force_man_mode_success(self, mock_client_class, client, mock_temporal_client):
        """Test successful force MAN mode."""
        mock_client_class.connect.return_value = mock_temporal_client

        request_data = {"scope": "STEPS", "step_ids": ["step1", "step2"]}

        response = client.post("/api/v1/workflows/wf-123/force-man-mode", json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "signal_sent"
        assert data["signal"] == "force_man_mode"
        assert data["scope"] == "STEPS"
        assert data["step_ids"] == ["step1", "step2"]

        # Verify signal was sent
        handle = mock_temporal_client.get_workflow_handle.return_value
        handle.signal.assert_called_once_with("force_man_mode", "STEPS", ["step1", "step2"])

    # ============================================================================
    # ERROR HANDLING
    # ============================================================================

    @patch("orchestrator.main.get_database_provider")
    def test_api_error_handling(self, mock_get_db_provider, client, mock_db):
        """Test API error handling."""
        mock_get_db_provider.return_value = mock_db
        mock_db.select.side_effect = Exception("Database connection failed")

        response = client.get("/api/v1/man/tasks")

        assert response.status_code == 500
        assert "Database connection failed" in response.json()["detail"]

    @patch("orchestrator.main.Client")
    def test_temporal_error_handling(self, mock_client_class, client):
        """Test Temporal client error handling."""
        mock_client_class.connect.side_effect = Exception("Temporal connection failed")

        signal_data = {"workflow_id": "wf-123", "reason": "Test"}

        response = client.post("/api/v1/workflows/wf-123/pause", json=signal_data)

        assert response.status_code == 500
        assert "Temporal connection failed" in response.json()["detail"]
