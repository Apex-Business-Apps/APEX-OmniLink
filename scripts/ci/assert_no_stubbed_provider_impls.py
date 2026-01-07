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

    print(f"🔍 Scanning directory: {directory}")
    has_errors = False

    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith(".py"):
                continue

            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read(), filename=filepath)

                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        # Detect 'pass' or '...' bodies
                        if len(node.body) == 1:
                            stmt = node.body[0]
                            is_pass = isinstance(stmt, ast.Pass)
                            is_ellipsis = (
                                isinstance(stmt, ast.Expr)
                                and isinstance(stmt.value, ast.Constant)
                                and stmt.value.value is Ellipsis
                            )
                            # Ignore @abstractmethod
                            is_abstract = any(
                                isinstance(d, ast.Name) and d.id == "abstractmethod"
                                for d in node.decorator_list
                            )

                            if (is_pass or is_ellipsis) and not is_abstract:
                                print(f"❌ Stub found in {filepath}:{node.lineno} - '{node.name}'")
                                has_errors = True
            except Exception as e:
                print(f"⚠️ Parse error {filepath}: {e}")

    return has_errors


if __name__ == "__main__":
    # --- ROBUST PATH RESOLUTION ---
    # Current: repo/scripts/ci/script.py
    script_path = os.path.abspath(__file__)
    # Go up 3 levels to Repo Root
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(script_path)))

    target_dir = os.path.join(repo_root, "orchestrator", "providers")

    print(f"📂 Repo Root: {repo_root}")
    print(f"🎯 Target: {target_dir}")

    if check_for_stubs(target_dir):
        print("FAILURE: Stubs found.")
        sys.exit(1)

    print("✅ SUCCESS: Codebase is clean.")
    sys.exit(0)
