import sys
import asyncio
from unittest.mock import MagicMock
import os

# Mocks for external libs
sys.modules["instructor"] = MagicMock()
sys.modules["litellm"] = MagicMock()
sys.modules["temporalio"] = MagicMock()
sys.modules["temporalio.activity"] = MagicMock()

# Mock logger
logger_mock = MagicMock()
logger_mock.info = print  # Print logs to stdout
sys.modules["temporalio.activity"].logger = logger_mock

# Mock decorators
def mock_defn(name=None):
    def decorator(func):
        return func
    return decorator
sys.modules["temporalio.activity"].defn = mock_defn

# Link temporalio.activity to ensure imports work correctly
sys.modules["temporalio"].activity = sys.modules["temporalio.activity"]

# Read tools.py
print("Reading activities/tools.py...")
with open("activities/tools.py", "r") as f:
    code = f.read()

# Replace relative imports with mocks
print("Mocking imports...")
code = code.replace("from ..models.audit import AuditAction, AuditResourceType, AuditStatus, log_audit_event", 
                    "class AuditAction: DATA_ACCESS='DATA_ACCESS'; DATA_MODIFY='DATA_MODIFY'; DATA_DELETE='DATA_DELETE'\n"
                    "class AuditResourceType: DATABASE='DATABASE'\n"
                    "class AuditStatus: SUCCESS='SUCCESS'; FAILURE='FAILURE'\n"
                    "async def log_audit_event(*args, **kwargs): pass")

code = code.replace("from ..providers.database.factory import get_database_provider", 
                    "def get_database_provider(): return MagicMock()")

code = code.replace("from infrastructure.cache import SemanticCacheService", "SemanticCacheService = MagicMock")

# Execute module
print("Executing module...")
module_namespace = {}
try:
    exec(code, module_namespace)
except Exception as e:
    print(f"Error executing tools.py: {e}")
    sys.exit(1)

# Extract functions
search_youtube = module_namespace.get("search_youtube")
send_email = module_namespace.get("send_email")

if not search_youtube:
    print("Error: search_youtube function not found. Did you add it to tools.py?")
    sys.exit(1)

# Test Workflow
async def run_test():
    print("\n--- Starting Sandboxed Workflow Test ---")
    
    # 1. Simulate Plan Generation
    print("\n1. Generating Plan...")
    # We process the prompt manually since LLM is mocked
    goal = "Search youtube for 'funny cat videos' and email to coworker"
    print(f"Goal: {goal}")
    
    # Mock the plan generation result since we don't have real LLM
    plan = {
        "plan_id": "test-plan-1",
        "steps": [
            {
                "id": "step1",
                "tool": "search_youtube",
                "input": {"query": "funny cat videos"}
            },
            {
                "id": "step2",
                "tool": "send_email",
                "input": {"to": "coworker@example.com", "body": "Check out this video: https://youtube.com/watch?v=mock123"}
            }
        ]
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
    email_result = await send_email({"to": "coworker@example.com", "body": f"Here is the video: {video_url}"})
    print(f"Result: {email_result}")
    
    if email_result["success"]:
        print("\n✅ Workflow Test PASSED")
    else:
        print("\n❌ Workflow Test FAILED")

if __name__ == "__main__":
    asyncio.run(run_test())
