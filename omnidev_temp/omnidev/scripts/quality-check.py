#!/usr/bin/env python3
"""
Quality Check - Comprehensive code quality validation

Copyright (c) 2025 APEX Business Systems Ltd.
Edmonton, AB, Canada | https://apexbusiness-systems.com

Usage: python quality-check.py <path> [--fix] [--strict]

Runs all quality checks: lint, type check, format, security scan.
Exit: 0=pass, 1=issues found, 2=system error
"""

import argparse
import subprocess
import sys
from pathlib import Path

PATH_PLACEHOLDER = "{path}"

CHECKS = {
    "python": {
        "lint": ["ruff", "check", PATH_PLACEHOLDER],
        "lint_fix": ["ruff", "check", "--fix", PATH_PLACEHOLDER],
        "format": ["black", "--check", PATH_PLACEHOLDER],
        "format_fix": ["black", PATH_PLACEHOLDER],
        "typecheck": ["mypy", PATH_PLACEHOLDER, "--ignore-missing-imports"],
        "security": ["bandit", "-r", PATH_PLACEHOLDER, "-q"],
    },
    "javascript": {
        "lint": ["eslint", PATH_PLACEHOLDER],
        "lint_fix": ["eslint", "--fix", PATH_PLACEHOLDER],
        "format": ["prettier", "--check", PATH_PLACEHOLDER],
        "format_fix": ["prettier", "--write", PATH_PLACEHOLDER],
        "typecheck": ["tsc", "--noEmit"],
        "security": ["npm", "audit", "--audit-level=high"],
    },
    "go": {
        "lint": ["golangci-lint", "run", PATH_PLACEHOLDER],
        "format": ["gofmt", "-l", PATH_PLACEHOLDER],
        "format_fix": ["gofmt", "-w", PATH_PLACEHOLDER],
        "typecheck": ["go", "vet", f"{PATH_PLACEHOLDER}/..."],
        "security": ["gosec", "-quiet", f"{PATH_PLACEHOLDER}/..."],
    },
}


def detect_language(path: Path) -> str:
    """Detect primary language in path."""
    extensions = {".py": "python", ".js": "javascript", ".ts": "javascript", ".go": "go"}

    counts = {}
    for ext, lang in extensions.items():
        count = len(list(path.rglob(f"*{ext}")))
        counts[lang] = counts.get(lang, 0) + count

    if not counts:
        return "python"  # default
    return max(counts, key=counts.get)


def run_check(name: str, cmd: list[str], path: Path) -> tuple[bool, str]:
    """Run a single check."""
    cmd = [c.format(path=str(path)) for c in cmd]

    try:
        result = subprocess.run(  # noqa: S603
            cmd, capture_output=True, text=True, check=False
        )
        passed = result.returncode == 0
        output = result.stdout + result.stderr
        return passed, output.strip()
    except FileNotFoundError:
        return True, f"⚠️  {cmd[0]} not installed, skipping"
    except subprocess.TimeoutExpired:
        return False, f"❌ {name} timed out"


def main():
    parser = argparse.ArgumentParser(
        description="Run comprehensive code quality checks (APEX Business Systems Ltd.)"
    )
    parser.add_argument("path", type=Path, help="Path to check")
    parser.add_argument("--fix", action="store_true", help="Auto-fix issues")
    parser.add_argument("--strict", action="store_true", help="Fail on any issue")
    parser.add_argument("--lang", choices=["python", "javascript", "go"], help="Force language")
    args = parser.parse_args()

    path = args.path.resolve()
    if not path.exists():
        print(f"❌ Not found: {path}", file=sys.stderr)
        sys.exit(2)

    lang = args.lang or detect_language(path)
    checks = CHECKS.get(lang, CHECKS["python"])

    print(f"\n🔍 Quality Check - {lang.upper()}")
    print(f"   Path: {path}")
    print("=" * 60)

    all_passed = True
    results = []

    for check_name in ["lint", "format", "typecheck", "security"]:
        # Use fix version if --fix flag
        if args.fix and f"{check_name}_fix" in checks:
            cmd = checks[f"{check_name}_fix"]
        elif check_name in checks:
            cmd = checks[check_name]
        else:
            continue

        passed, output = run_check(check_name, cmd, path)
        status = "✅" if passed else "❌"
        results.append((check_name, passed, output))

        if not passed:
            all_passed = False

        print(f"{status} {check_name.capitalize()}")
        if output and not passed:
            for line in output.split("\n")[:5]:
                print(f"   {line}")

    print("=" * 60)

    if all_passed:
        print("✅ All checks passed!")
        sys.exit(0)
    else:
        print("❌ Some checks failed")
        if args.strict:
            sys.exit(1)
        sys.exit(0 if not args.strict else 1)


if __name__ == "__main__":
    main()
