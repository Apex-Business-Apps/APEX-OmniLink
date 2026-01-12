# APEX OmniHub Sandbox Environment

The sandbox environment allows for isolated testing of Temporal activities and workflows without requiring a full Temporal server or external API credentials. It uses Python's `unittest.mock` to simulate dependencies.

## Key Components

### 1. `sandbox_test.py`
The main entry point for running sandboxed tests. It:
- Mocks `temporalio` and its submodules.
- Mocks `instructor` and `litellm` for LLM interactions.
- Loads `activities/tools.py` securely using `importlib`.
- Simulates a workflow execution plan (e.g., YouTube search + Email).

### 2. Mocked Dependencies
- **Temporal**: Activities are executed as standard async Python functions.
- **LLM**: Plan generation is mocked to return deterministic steps.
- **Database**: `get_database_provider` returns a `MagicMock`.
- **Cache**: `SemanticCacheService` is mocked.

## How to Run

1. Navigate to the `orchestrator` directory:
   ```powershell
   cd orchestrator
   ```

2. Run the sandbox test script:
   ```powershell
   python sandbox_test.py
   ```

## Adding New Tests
To add a new test case (like the "Restaurant Worker" story):
1. Create a new test file (e.g., `tests/integration/test_scenario_name.py`).
2. Import the necessary activities from `activities.tools`.
3. Use `unittest.mock` or the patterns in `sandbox_test.py` to mock external calls.
4. Define the formatted input and expected output for the activities.

## Recent Capabilities
- **YouTube Search**: New `search_youtube` activity added to `tools.py`.
- **Security**: `sandbox_test.py` uses safe module loading (no `exec`).
