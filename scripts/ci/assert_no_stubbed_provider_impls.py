#!/usr/bin/env python3
import ast
import os
import sys


def is_stub_function(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    """
    Check if a function node is a stub (pass or ellipsis without @abstractmethod).

    Returns:
        True if function is a stub implementation
    """
    # Function must have exactly one statement
    if len(node.body) != 1:
        return False

    stmt = node.body[0]
    is_pass = isinstance(stmt, ast.Pass)
    is_ellipsis = (
        isinstance(stmt, ast.Expr)
        and isinstance(stmt.value, ast.Constant)
        and stmt.value.value is Ellipsis
    )

    # Ignore @abstractmethod decorated functions
    is_abstract = any(
        isinstance(d, ast.Name) and d.id == "abstractmethod" for d in node.decorator_list
    )

    return (is_pass or is_ellipsis) and not is_abstract


def check_file_for_stubs(filepath: str) -> list[str]:
    """
    Parse a Python file and find stub function implementations.

    Returns:
        List of error messages for stub functions found
    """
    errors = []
    try:
        with open(filepath, encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=filepath)

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if is_stub_function(node):
                    errors.append(f"❌ Stub found in {filepath}:{node.lineno} - '{node.name}'")
    except Exception as e:
        errors.append(f"⚠️ Parse error {filepath}: {e}")

    return errors


def check_for_stubs(directory: str) -> bool:
    """Check directory for stub function implementations.

    Returns:
        True if stubs were found (error condition)
    """
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
            file_errors = check_file_for_stubs(filepath)

            if file_errors:
                has_errors = True
                for error in file_errors:
                    print(error)

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
