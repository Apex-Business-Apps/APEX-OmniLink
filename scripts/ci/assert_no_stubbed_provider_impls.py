#!/usr/bin/env python3
import ast
import sys
from pathlib import Path
from typing import List


class StubDetector(ast.NodeVisitor):
    """
    AST visitor that detects stubbed implementations.

    A function is considered stubbed if it contains only:
    - pass statements
    - ... (Ellipsis)
    - raise NotImplementedError
    - Comments and docstrings
    """

    def __init__(self):
        self.stubbed_functions: List[str] = []
        self.current_function: str = ""

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Visit function definitions and check if they're stubbed."""
        old_function = self.current_function
        self.current_function = node.name

        # Check if function body is stubbed
        if self._is_stubbed_body(node.body):
            self.stubbed_functions.append(node.name)

        self.current_function = old_function
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """Visit async function definitions."""
        old_function = self.current_function
        self.current_function = node.name

        # Check if function body is stubbed
        if self._is_stubbed_body(node.body):
            self.stubbed_functions.append(node.name)


def check_for_stubs(directory):
    if not os.path.exists(directory):
        print(f"❌ Error: Target directory not found: {directory}")
        return True

    def _is_stubbed_statement(self, stmt: ast.stmt) -> bool:
        """Check if a statement is stubbed/placeholder code."""
        if isinstance(stmt, ast.Pass):
            return True
        elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
            # Ellipsis (...)
            if stmt.value.value is ...:
                return True
            return False
        elif isinstance(stmt, ast.Raise):
            # raise NotImplementedError(...)
            if (
                isinstance(stmt.exc, ast.Call)
                and isinstance(stmt.exc.func, ast.Name)
                and stmt.exc.func.id == "NotImplementedError"
            ):
                return True
            return False
        else:
            return False


def scan_file_for_stubs(file_path: Path) -> List[str]:
    """Scan a Python file for stubbed functions."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        tree = ast.parse(content)
        detector = StubDetector()
        detector.visit(tree)


if __name__ == "__main__":
    # --- ROBUST PATH RESOLUTION ---
    # Current: repo/scripts/ci/script.py
    script_path = os.path.abspath(__file__)
    # Go up 3 levels to Repo Root
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(script_path)))

    target_dir = os.path.join(repo_root, "orchestrator", "providers")

    # Report results
    if stubbed_functions:
        print("❌ STUBBED PROVIDER IMPLEMENTATIONS FOUND:")
        for stub in stubbed_functions:
            print(f"  - {stub}")
        print()
        print("All provider implementations must be fully implemented.")
        print(
            "Replace stubbed functions (pass, ..., NotImplementedError) with real code."
        )
        return 1
    else:
        print("✅ No stubbed provider implementations found.")
        return 0

    if check_for_stubs(target_dir):
        print("FAILURE: Stubs found.")
        sys.exit(1)

    print("✅ SUCCESS: Codebase is clean.")
    sys.exit(0)
