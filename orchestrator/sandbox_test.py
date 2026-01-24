import asyncio
import importlib.util
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

# Mocks for external libs
TEMPORALIO_ACTIVITY_MODULE = "temporalio.activity"
sys.modules["instructor"] = MagicMock()
sys.modules["litellm"] = MagicMock()
sys.modules["temporalio"] = MagicMock()
sys.modules[TEMPORALIO_ACTIVITY_MODULE] = MagicMock()

# Mock logger
logger_mock = MagicMock()
logger_mock.info = print  # Print logs to stdout
sys.modules[TEMPORALIO_ACTIVITY_MODULE].logger = logger_mock


# Mock decorators
def mock_defn(_name=None):
    def decorator(func):
        return func

    return decorator


sys.modules[TEMPORALIO_ACTIVITY_MODULE].defn = mock_defn

# Link temporalio.activity to ensure imports work correctly
sys.modules["temporalio"].activity = sys.modules[TEMPORALIO_ACTIVITY_MODULE]

# Constants for replacements to avoid long lines
AUDIT_IMPORT = (
    "from ..models.audit import AuditAction, AuditResourceType, AuditStatus, log_audit_event"
)
AUDIT_MOCK = (
    "from unittest.mock import MagicMock\n"
    "class AuditAction: DATA_ACCESS='DATA_ACCESS'; "
    "DATA_MODIFY='DATA_MODIFY'; DATA_DELETE='DATA_DELETE'\n"
    "class AuditResourceType: DATABASE='DATABASE'\n"
    "class AuditStatus: SUCCESS='SUCCESS'; FAILURE='FAILURE'\n"
    "async def log_audit_event(*args, **kwargs): pass"
)
DB_IMPORT = "from ..providers.database.factory import get_database_provider"
DB_MOCK = "def get_database_provider(): return MagicMock()"
CACHE_IMPORT = "from infrastructure.cache import SemanticCacheService"
CACHE_MOCK = "SemanticCacheService = MagicMock"


def load_tools_module():
    """Load tools.py with mocked dependencies."""
    print("Reading activities/tools.py...")
    tools_path = Path(__file__).resolve().parent / "activities" / "tools.py"
    code = tools_path.read_text(encoding="utf-8")

    print("Mocking imports...")
    code = code.replace(AUDIT_IMPORT, AUDIT_MOCK)
    code = code.replace(DB_IMPORT, DB_MOCK)
    code = code.replace(CACHE_IMPORT, CACHE_MOCK)

    print("Executing module with safe loader...")
    # Use NamedTemporaryFile to avoid path injection vulnerability (S2083)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", prefix="tools_sandbox_", encoding="utf-8", delete=False
    ) as tmp_file:
        tmp_file.write(code)
        tmp_path = tmp_file.name

    try:
        spec = importlib.util.spec_from_file_location("tools_sandbox", tmp_path)
        if spec is None or spec.loader is None:
            raise RuntimeError("Failed to create module spec for tools_sandbox")

        tools_mod = importlib.util.module_from_spec(spec)
        sys.modules["tools_sandbox"] = tools_mod
        spec.loader.exec_module(tools_mod)
        return tools_mod
    finally:
        # Clean up temporary file
        Path(tmp_path).unlink(missing_ok=True)


# Load the module
tools_mod = load_tools_module()
search_youtube = tools_mod.search_youtube
send_email = tools_mod.send_email


async def run_test():
    """Run the sandboxed workflow test."""
    print("\n--- Starting Sandboxed Workflow Test ---")

    # 1. Simulate Plan Generation
    print("\n1. Generating Plan...")
    goal = "Search youtube for 'funny cat videos' and email to coworker"
    print(f"Goal: {goal}")

    # Mock the plan generation result since we don't have real LLM
    email_body = "Check out this video: https://youtube.com/watch?v=mock123"
    plan = {
        "plan_id": "test-plan-1",
        "steps": [
            {
                "id": "step1",
                "tool": "search_youtube",
                "input": {"query": "funny cat videos"},
            },
            {
                "id": "step2",
                "tool": "send_email",
                "input": {"to": "coworker@example.com", "body": email_body},
            },
        ],
    }
    print(f"Generated Plan: {plan}")

    # 2. Execute Step 1: Search YouTube
    print("\n2. Executing Step 1: Search YouTube")
    yt_result = await search_youtube({"query": "funny cat videos"})
    print(f"Result: {yt_result}")

    if not yt_result["success"]:
        print("FAILED")
        return

    if not yt_result.get("videos"):
        print("No videos found")
        return

    video_url = yt_result["videos"][0]["url"]
    print(f"Found video: {video_url}")

    # 3. Execute Step 2: Send Email
    print("\n3. Executing Step 2: Send Email")
    payload = {"to": "coworker@example.com", "body": f"Here is the video: {video_url}"}
    email_result = await send_email(payload)
    print(f"Result: {email_result}")

    if email_result["success"]:
        print("\n✅ Workflow Test PASSED")
    else:
        print("\n❌ Workflow Test FAILED")


if __name__ == "__main__":
    asyncio.run(run_test())
