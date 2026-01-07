#!/usr/bin/env python3
"""
CI Guardrail: Assert no stubbed provider implementations.

This script scans the orchestrator codebase and fails if any database provider
methods are implemented as stubs (pass, ..., or raise NotImplementedError).

This prevents production deployments with incomplete provider implementations.
"""

import ast
import os
import sys
from pathlib import Path
from typing import List, Set


class ProviderImplementationChecker(ast.NodeVisitor):
    """
    AST visitor that checks for stubbed method implementations in providers.
    """

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.violations: List[str] = []
        self.current_class: str | None = None
        self.current_function: str | None = None

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """Track current class being visited."""
        old_class = self.current_class
        self.current_class = node.name

        # Only check provider classes
        if "Provider" in node.name:
            self.generic_visit(node)

        self.current_class = old_class

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Check function implementations for stubs."""
        if not self.current_class or "Provider" not in self.current_class:
            return

        old_function = self.current_function
        self.current_function = node.name

        # Check if this is a provider method (async def)
        if isinstance(node, ast.AsyncFunctionDef):
            self._check_method_implementation(node)

        self.current_function = old_function

    def _check_method_implementation(self, node: ast.AsyncFunctionDef) -> None:
        """Check if method implementation is a stub."""
        if not node.body:
            return

        # Check for various stub patterns
        first_stmt = node.body[0]

        # Pattern 1: pass
        if isinstance(first_stmt, ast.Pass):
            self._add_violation(f"Method {self.current_function} implemented as 'pass'")

        # Pattern 2: ... (Ellipsis)
        elif isinstance(first_stmt, ast.Expr) and isinstance(first_stmt.value, ast.Ellipsis):
            self._add_violation(f"Method {self.current_function} implemented as '...'")

        # Pattern 3: raise NotImplementedError
        elif isinstance(first_stmt, ast.Raise):
            if isinstance(first_stmt.exc, ast.Call):
                if isinstance(first_stmt.exc.func, ast.Name):
                    if first_stmt.exc.func.id == "NotImplementedError":
                        self._add_violation(f"Method {self.current_function} raises NotImplementedError")

        # Pattern 4: return None (for methods that should return data)
        elif isinstance(first_stmt, ast.Return) and first_stmt.value is None:
            # Allow return None for some methods, but flag suspicious ones
            method_name = node.name
            if method_name in {"select", "insert", "update", "upsert", "select_one"}:
                self._add_violation(f"Method {self.current_function} returns None (suspicious for data method)")

    def _add_violation(self, message: str) -> None:
        """Add a violation to the list."""
        self.violations.append(f"{self.file_path}:{self.current_class}.{self.current_function}: {message}")


def check_file(file_path: Path) -> List[str]:
    """Check a single file for stubbed implementations."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        tree = ast.parse(content, filename=str(file_path))
        checker = ProviderImplementationChecker(str(file_path))
        checker.visit(tree)

        return checker.violations

    except SyntaxError as e:
        return [f"{file_path}: Syntax error - {e}"]
    except Exception as e:
        return [f"{file_path}: Error checking file - {e}"]


def main() -> int:
    """Main entry point."""
    print("🔍 Checking for stubbed provider implementations...")

    # Find all Python files in orchestrator/providers
    orchestrator_dir = Path(__file__).parent.parent / "orchestrator"
    providers_dir = orchestrator_dir / "providers"

    if not providers_dir.exists():
        print(f"❌ Providers directory not found: {providers_dir}")
        return 1

    # Find all Python files in providers directory
    python_files = list(providers_dir.glob("**/*.py"))

    if not python_files:
        print("⚠️  No Python files found in providers directory")
        return 0

    print(f"📁 Scanning {len(python_files)} files in {providers_dir}")

    all_violations: List[str] = []

    for file_path in python_files:
        violations = check_file(file_path)
        all_violations.extend(violations)

    # Report results
    if all_violations:
        print(f"\n❌ Found {len(all_violations)} violations:")
        for violation in all_violations:
            print(f"  {violation}")

        print("\n💡 Fix these by implementing the stubbed methods with proper database operations.")
        print("   This check prevents deploying incomplete provider implementations to production.")
        return 1
    else:
        print("✅ All provider implementations are properly implemented!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
