#!/usr/bin/env python3
"""
CI Guardrail: Assert no forbidden SDK imports in activities/workflows.

This script scans the orchestrator codebase and fails if any activities or workflows
directly import vendor SDKs that should only be used in providers.

This prevents bypassing the abstraction layer and ensures portability.
"""

import ast
import os
import re
import sys
from pathlib import Path
from typing import List, Set


class ForbiddenImportChecker(ast.NodeVisitor):
    """
    AST visitor that checks for forbidden SDK imports in activities/workflows.
    """

    # Forbidden import patterns (regex patterns)
    FORBIDDEN_PATTERNS = [
        # Supabase SDK
        r"^supabase$",
        r"^from supabase",
        r"^import supabase",

        # Direct database drivers
        r"^psycopg2?$",
        r"^from psycopg",
        r"^import psycopg",
        r"^pymongo$",
        r"^from pymongo",
        r"^import pymongo",

        # Cloud provider SDKs
        r"^boto3$",
        r"^from boto3",
        r"^import boto3",
        r"^google\.cloud",
        r"^azure\.",

        # Generic patterns for common SDKs
        r"create_client$",  # Supabase client creation
        r"\.Client\(\)",    # Generic client patterns
    ]

    # Allowed imports (even if they match forbidden patterns)
    ALLOWED_IMPORTS = {
        # Standard library and known safe imports
        "typing", "json", "datetime", "uuid", "asyncio",
        "temporalio", "pydantic", "instructor", "litellm",
        # Our own modules
        "models.", "providers.", "infrastructure.", "activities.", "workflows.",
        # Explicitly allowed
        "temporalio.common.RetryPolicy",
        "temporalio.exceptions.ActivityError",
        "temporalio.exceptions.ApplicationError",
    }

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.violations: List[str] = []
        self.current_imports: Set[str] = set()

    def visit_Import(self, node: ast.Import) -> None:
        """Check import statements."""
        for alias in node.names:
            import_name = alias.name
            self._check_import(import_name, node.lineno)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """Check from import statements."""
        module_name = node.module or ""
        for alias in node.names:
            import_name = f"{module_name}.{alias.name}" if module_name else alias.name
            self._check_import(import_name, node.lineno)

    def _check_import(self, import_name: str, lineno: int) -> None:
        """Check if an import is forbidden."""
        # Skip allowed imports
        if any(allowed in import_name for allowed in self.ALLOWED_IMPORTS):
            return

        # Check against forbidden patterns
        for pattern in self.FORBIDDEN_PATTERNS:
            if re.match(pattern, import_name):
                self.violations.append(
                    f"{self.file_path}:{lineno}: Forbidden SDK import '{import_name}'"
                )
                break


def check_file(file_path: Path) -> List[str]:
    """Check a single file for forbidden imports."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        tree = ast.parse(content, filename=str(file_path))
        checker = ForbiddenImportChecker(str(file_path))
        checker.visit(tree)

        return checker.violations

    except SyntaxError as e:
        return [f"{file_path}: Syntax error - {e}"]
    except Exception as e:
        return [f"{file_path}: Error checking file - {e}"]


def main() -> int:
    """Main entry point."""
    print("🚫 Checking for forbidden SDK imports in activities/workflows...")

    # Find all Python files in activities and workflows directories
    # Script is at scripts/ci/assert_no_forbidden_sdk_imports.py
    # Need to go up to root, then into orchestrator
    root_dir = Path(__file__).parent.parent.parent
    orchestrator_dir = root_dir / "orchestrator"

    check_dirs = [
        orchestrator_dir / "activities",
        orchestrator_dir / "workflows"
    ]

    python_files = []
    for check_dir in check_dirs:
        if check_dir.exists():
            python_files.extend(check_dir.glob("**/*.py"))

    if not python_files:
        print("⚠️  No Python files found in activities/workflows directories")
        return 0

    print(f"📁 Scanning {len(python_files)} files in activities/workflows")

    all_violations: List[str] = []

    for file_path in python_files:
        violations = check_file(file_path)
        all_violations.extend(violations)

    # Report results
    if all_violations:
        print(f"\n❌ Found {len(all_violations)} forbidden imports:")
        for violation in all_violations:
            print(f"  {violation}")

        print("\n💡 Fix these by using the appropriate provider abstraction instead.")
        print("   Activities and workflows should never directly import vendor SDKs.")
        print("   Use get_database_provider() or other abstractions from providers/.")
        return 1
    else:
        print("✅ No forbidden SDK imports found!")
        return 0


if __name__ == "__main__":
    sys.exit(main())