# APEX OmniHub Sandbox Test Specification
## Google IDX / Project Antigravity Environment

---

## 🎯 TEST OBJECTIVE

Execute a full end-to-end simulation of the **Restaurant Worker Financial Transfer** user story to validate:
1. Temporal workflow orchestration
2. MAN Mode safety gate classification
3. Saga compensation registration
4. Multi-service integration via OmniLink adapters
5. Audit trail generation

---

## 📋 USER STORY UNDER TEST

```gherkin
Feature: Cross-Platform Financial Transfer with Screenshot Confirmation

  As Marco Rodriguez (Restaurant Line Cook / Uber Driver)
  I want to withdraw earnings from my Uber driver account and transfer to my bank
  So that I can access my gig economy income without manual app switching

  Background:
    Given I am an authenticated user with verified identity
    And I have linked my Uber Driver account (earnings: $1,247.83)
    And I have linked my Chase checking account (***4521)
    And I have a verified email address (marco.r@gmail.com)

  Scenario: Voice-initiated multi-step financial workflow
    When I say "Hey APEX, withdraw $500 from my Uber driver account, 
         transfer it to my Chase checking, take a screenshot of the 
         confirmation, and email it to me"
    Then the system should parse my intent into 4 discrete steps
    And the system should classify "uber_wallet_withdraw" as RED lane
    And the system should request my biometric approval
    When I approve via Face ID
    Then the system should execute the withdrawal
    And the system should verify the incoming ACH transfer
    And the system should capture a screenshot of the confirmation
    And the system should email me the confirmation with attachment
    And the total execution time should be under 15 seconds
    And all 4 steps should have audit log entries
    And the saga compensation stack should contain 3 rollback handlers
```

---

## 🔧 SANDBOX ENVIRONMENT SETUP

### Prerequisites

```yaml
# idx-environment.nix or devcontainer.json equivalent
environment:
  runtime: python-3.11
  services:
    - temporal-server:latest
    - redis:7-alpine
    - postgres:15
  
  env_vars:
    # Mock API Keys (sandbox-safe)
    ANTHROPIC_API_KEY: "sk-ant-sandbox-test-key-not-real"
    OPENAI_API_KEY: "sk-sandbox-test-key-not-real"
    
    # Temporal
    TEMPORAL_HOST: "localhost:7233"
    TEMPORAL_NAMESPACE: "apex-sandbox"
    TEMPORAL_TASK_QUEUE: "apex-orchestrator-test"
    
    # Redis (local)
    REDIS_URL: "redis://localhost:6379"
    
    # Supabase (mock or local)
    SUPABASE_URL: "http://localhost:54321"
    SUPABASE_SERVICE_ROLE_KEY: "sandbox-service-role-key"
    
    # Test Mode Flags
    APEX_SANDBOX_MODE: "true"
    MOCK_EXTERNAL_APIS: "true"
    SKIP_BIOMETRIC_AUTH: "false"  # Simulate with PIN
    
  packages:
    - temporalio
    - pydantic-settings
    - litellm
    - instructor
    - httpx
    - pytest
    - pytest-asyncio
```

---

## 🧪 TEST PROMPT FOR IDX AGENT

Copy this prompt into Google IDX / Antigravity IDE agent:

```markdown
# APEX OmniHub Sandbox Test Execution

## Context
You are testing the APEX OmniHub orchestration system. The codebase is located in 
the current workspace. Key directories:
- `orchestrator/` - Temporal workflows and activities
- `orchestrator/workflows/agent_saga.py` - Main workflow
- `orchestrator/activities/` - Tool implementations
- `orchestrator/policies/man_policy.py` - MAN Mode risk classification

## Task
Execute a sandbox simulation of the following user story:

**User:** Marco Rodriguez (user_id: "test-user-marco-001")
**Command:** "Withdraw $500 from my Uber driver account, transfer it to my Chase 
checking, take a screenshot of the confirmation, and email it to me."

## Steps to Execute

### Step 1: Setup Test Environment
```bash
cd orchestrator
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start Temporal (if not running)
temporal server start-dev --namespace apex-sandbox &

# Verify Redis
redis-cli ping
```

### Step 2: Create Mock Adapters
Create `orchestrator/tests/mocks/adapters.py` with mock implementations for:
- `uber_wallet_withdraw` → Returns mock tx_id
- `bank_verify_incoming` → Returns mock ACH confirmation
- `capture_screen` → Returns mock S3 URL
- `send_email` → Returns mock message_id

### Step 3: Write Integration Test
Create `orchestrator/tests/integration/test_marco_workflow.py`:

```python
import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from workflows.agent_saga import AgentSagaWorkflow
from activities.tools import (
    check_semantic_cache,
    generate_plan_with_llm,
    search_database,
    send_email,
)
from activities.man_mode import (
    risk_triage,
    create_man_task,
    resolve_man_task,
)

# Import mocks
from tests.mocks.adapters import (
    mock_uber_withdraw,
    mock_bank_verify,
    mock_capture_screen,
    mock_send_email,
)


@pytest.fixture
async def workflow_env():
    async with await WorkflowEnvironment.start_local() as env:
        yield env


@pytest.mark.asyncio
async def test_marco_restaurant_worker_flow(workflow_env):
    """
    Full E2E test of Marco's financial transfer workflow.
    
    Expected behavior:
    1. LLM generates 4-step plan
    2. Step 1 (uber_withdraw) triggers RED lane → MAN approval
    3. After approval, all steps execute
    4. Saga stack has 3 compensations registered
    5. Audit log has 12+ events
    """
    
    # Arrange
    user_id = "test-user-marco-001"
    goal = (
        "Withdraw $500 from my Uber driver account, transfer it to my "
        "Chase checking, take a screenshot of the confirmation, and email it to me."
    )
    context = {
        "user_id": user_id,
        "linked_accounts": {
            "uber": {"type": "driver", "balance": 1247.83},
            "chase": {"account_id": "chase_***4521", "type": "checking"},
        },
        "email": "marco.r@gmail.com",
    }
    
    # Register activities
    activities = [
        check_semantic_cache,
        generate_plan_with_llm,
        risk_triage,
        create_man_task,
        resolve_man_task,
        mock_uber_withdraw,
        mock_bank_verify,
        mock_capture_screen,
        mock_send_email,
    ]
    
    async with Worker(
        workflow_env.client,
        task_queue="apex-orchestrator-test",
        workflows=[AgentSagaWorkflow],
        activities=activities,
    ):
        # Act
        workflow_id = f"test-marco-{pytest.helpers.uuid4()}"
        
        result = await workflow_env.client.execute_workflow(
            AgentSagaWorkflow.run,
            args=[{
                "goal": goal,
                "user_id": user_id,
                "context": context,
            }],
            id=workflow_id,
            task_queue="apex-orchestrator-test",
        )
        
        # Assert - Workflow completed
        assert result["status"] == "completed"
        assert result["steps_executed"] == 4
        
        # Assert - MAN Mode triggered
        assert any(
            r.get("man_task_id") for r in result.get("results", {}).values()
        ), "Expected MAN approval task for financial operation"
        
        # Assert - Saga stack populated
        # (In real test, inspect workflow history)
        
        # Assert - Audit trail
        # (Query audit_logs table for workflow_id)
        
        print(f"✅ Workflow {workflow_id} completed successfully")
        print(f"   Steps: {result['steps_executed']}")
        print(f"   Duration: {result.get('duration_seconds', 'N/A')}s")
        
        return result
```

### Step 4: Run the Test
```bash
# From orchestrator directory
pytest tests/integration/test_marco_workflow.py -v --tb=short

# Or with coverage
pytest tests/integration/test_marco_workflow.py -v --cov=workflows --cov=activities
```

### Step 5: Capture Results
After test execution, collect:
1. Test output (pass/fail, assertions)
2. Temporal workflow history (via `temporal workflow show -w <workflow_id>`)
3. Audit log entries (query Supabase/Postgres)
4. Saga compensation stack state
5. MAN task record

### Step 6: Document Findings
Create a professional test report with:
- Test execution summary
- Step-by-step trace with timestamps
- MAN Mode classification decisions
- Any failures or unexpected behaviors
- Performance metrics

## Expected Outputs

### Successful Execution Should Show:
```
✅ Step 1: uber_wallet_withdraw
   - Lane: RED
   - MAN Task Created: man_task_abc123
   - Approval: APPROVED (simulated)
   - Result: {tx_id: "UBR-2026-SANDBOX-001"}
   - Compensation Registered: uber_wallet_cancel_withdrawal

✅ Step 2: bank_verify_incoming
   - Lane: GREEN (read-only)
   - Result: {status: "pending", eta: "2026-01-13"}
   - No compensation (verification only)

✅ Step 3: capture_screen
   - Lane: YELLOW (unknown tool)
   - Result: {s3_key: "screenshots/sandbox/marco-confirm.png"}
   - Compensation Registered: delete_screenshot

✅ Step 4: send_email
   - Lane: RED (pre-approved in batch)
   - Result: {message_id: "msg_sandbox_001"}
   - Compensation Registered: void_email (no-op)

📊 Workflow Summary:
   - Total Steps: 4
   - Execution Time: 3.2s (mock APIs)
   - MAN Approvals: 1
   - Saga Stack Size: 3
   - Audit Events: 14
```

## Failure Scenarios to Test

Also test these edge cases:
1. **MAN Denial**: User rejects the approval → workflow should halt, no withdrawal
2. **Uber API Failure**: Mock 500 error → saga should trigger cancel_withdrawal
3. **Screenshot Timeout**: Mock timeout → should continue without blocking email
4. **Insufficient Balance**: Uber returns "insufficient_funds" → handle gracefully

## Report Template
After execution, generate report using the template in the next section.
```

---

## 📊 TEST EXECUTION CHECKLIST

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Workflow starts successfully | workflow_id generated | ⬜ |
| 2 | LLM generates 4-step plan | plan.steps.length == 4 | ⬜ |
| 3 | uber_withdraw classified RED | lane == "RED" | ⬜ |
| 4 | MAN task created | man_task_id present | ⬜ |
| 5 | Approval triggers execution | step continues after approval | ⬜ |
| 6 | bank_verify classified GREEN | lane == "GREEN" | ⬜ |
| 7 | capture_screen classified YELLOW | lane == "YELLOW" | ⬜ |
| 8 | send_email executes | message_id returned | ⬜ |
| 9 | Saga stack has 3 compensations | compensation_stack.length == 3 | ⬜ |
| 10 | Audit log populated | audit_events >= 12 | ⬜ |
| 11 | Total time < 15s | duration_seconds < 15 | ⬜ |
| 12 | No unhandled exceptions | status == "completed" | ⬜ |

---

## 🔐 SECURITY NOTES FOR SANDBOX

```yaml
sandbox_security:
  - DO NOT use real API keys
  - DO NOT connect to production databases
  - DO NOT send real emails (use mock or Mailhog)
  - DO NOT process real financial transactions
  - ALL external APIs must be mocked
  - Test user data must be synthetic
  
mock_credentials:
  uber_api: "SANDBOX_UBER_TOKEN_NOT_REAL"
  plaid_api: "SANDBOX_PLAID_TOKEN_NOT_REAL"
  resend_api: "SANDBOX_RESEND_TOKEN_NOT_REAL"
```

---

## 📁 FILES TO CREATE IN SANDBOX

```
orchestrator/
├── tests/
│   ├── mocks/
│   │   ├── __init__.py
│   │   └── adapters.py          # Mock external services
│   ├── integration/
│   │   └── test_marco_workflow.py  # Main test file
│   └── fixtures/
│       └── marco_context.json    # Test user context
```

---

## ▶️ EXECUTE NOW

Run this test suite and document ALL outputs in the Results Template (next document).
