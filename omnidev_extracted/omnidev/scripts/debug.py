#!/usr/bin/env python3
"""
OmniDev Debug Assistant - Automated debugging workflow

Copyright (c) 2025 APEX Business Systems Ltd.
Edmonton, AB, Canada
https://apexbusiness-systems.com

Usage: python debug.py <error-message-or-log-file> [--lang <language>]

Analyzes errors and provides targeted fixes.

Exit: 0=success, 1=input error, 2=analysis error
"""
import sys
import re
import argparse
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

VERSION = "1.0.0"

@dataclass
class ErrorPattern:
    pattern: str
    category: str
    cause: str
    fix: str
    example: str


# Common error patterns by language
ERROR_PATTERNS = {
    "javascript": [
        ErrorPattern(
            pattern=r"TypeError: Cannot read propert.*of (undefined|null)",
            category="Null Reference",
            cause="Accessing property on undefined/null value",
            fix="Add optional chaining: obj?.property or null check",
            example="const name = user?.profile?.name ?? 'default';"
        ),
        ErrorPattern(
            pattern=r"ReferenceError: (\w+) is not defined",
            category="Reference Error",
            cause="Variable/function not declared or imported",
            fix="Import the module or declare the variable",
            example="import { missingFunction } from './module';"
        ),
        ErrorPattern(
            pattern=r"SyntaxError: Unexpected token",
            category="Syntax Error",
            cause="Invalid syntax, often malformed JSON or missing brackets",
            fix="Check for missing commas, brackets, or invalid characters",
            example="JSON.parse(data) // Validate JSON first"
        ),
        ErrorPattern(
            pattern=r"RangeError: Maximum call stack",
            category="Stack Overflow",
            cause="Infinite recursion or very deep recursion",
            fix="Add base case or convert to iteration",
            example="if (depth > 1000) return; // Add recursion limit"
        ),
    ],
    "python": [
        ErrorPattern(
            pattern=r"AttributeError: 'NoneType' object has no attribute",
            category="Null Reference",
            cause="Calling method/attribute on None",
            fix="Add None check before access",
            example="if obj is not None: obj.method()"
        ),
        ErrorPattern(
            pattern=r"KeyError: ['\"](\w+)['\"]",
            category="Key Error",
            cause="Dictionary key doesn't exist",
            fix="Use .get() with default or check key existence",
            example="value = data.get('key', default_value)"
        ),
        ErrorPattern(
            pattern=r"ImportError: No module named",
            category="Import Error",
            cause="Module not installed or path incorrect",
            fix="Install module or check PYTHONPATH",
            example="pip install missing-module"
        ),
        ErrorPattern(
            pattern=r"IndentationError",
            category="Syntax Error",
            cause="Inconsistent indentation (tabs vs spaces)",
            fix="Use consistent indentation (4 spaces recommended)",
            example="# Configure editor: 4 spaces, no tabs"
        ),
    ],
    "go": [
        ErrorPattern(
            pattern=r"panic: runtime error: invalid memory address",
            category="Nil Pointer",
            cause="Dereferencing nil pointer",
            fix="Add nil check before dereference",
            example="if ptr != nil { value := *ptr }"
        ),
        ErrorPattern(
            pattern=r"undefined: (\w+)",
            category="Undefined",
            cause="Variable/function not declared or exported",
            fix="Declare variable or export (capitalize first letter)",
            example="func ExportedFunc() {} // Capitalized = exported"
        ),
    ],
    "rust": [
        ErrorPattern(
            pattern=r"error\[E0382\]: borrow of moved value",
            category="Ownership Error",
            cause="Value moved, can't use after move",
            fix="Clone value, use reference, or restructure ownership",
            example="let y = x.clone(); // Clone to keep original"
        ),
        ErrorPattern(
            pattern=r"error\[E0502\]: cannot borrow.*as mutable",
            category="Borrow Error",
            cause="Can't have mutable and immutable borrows simultaneously",
            fix="Restructure to avoid overlapping borrows",
            example="{ let x = &mut data; } // Scope the borrow"
        ),
    ],
}


def detect_language(content: str) -> str:
    """Detect programming language from error content."""
    indicators = {
        "javascript": ["TypeError", "ReferenceError", "node_modules", ".js:", "npm"],
        "python": ["Traceback", "File \"", ".py\"", "AttributeError", "pip"],
        "go": ["panic:", ".go:", "goroutine", "package main"],
        "rust": ["error[E", ".rs:", "cargo", "rustc"],
        "java": [".java:", "Exception in thread", "at com.", "NullPointerException"],
    }
    
    content_lower = content.lower()
    scores = {}
    
    for lang, patterns in indicators.items():
        score = sum(1 for p in patterns if p.lower() in content_lower)
        if score > 0:
            scores[lang] = score
    
    if scores:
        return max(scores, key=scores.get)
    return "javascript"  # Default


def analyze_error(content: str, language: str) -> list[dict]:
    """Analyze error content and return matches."""
    matches = []
    patterns = ERROR_PATTERNS.get(language, [])
    
    for ep in patterns:
        if re.search(ep.pattern, content, re.IGNORECASE):
            matches.append({
                "category": ep.category,
                "cause": ep.cause,
                "fix": ep.fix,
                "example": ep.example,
            })
    
    return matches


def extract_stack_trace(content: str) -> list[str]:
    """Extract relevant lines from stack trace."""
    lines = content.split('\n')
    relevant = []
    
    for line in lines:
        # Skip node_modules, vendor, site-packages
        if any(skip in line for skip in ['node_modules', 'vendor', 'site-packages']):
            continue
        # Keep lines with file paths
        if re.search(r'\.(js|ts|py|go|rs|java)[:"]', line):
            relevant.append(line.strip())
    
    return relevant[:5]  # Top 5 relevant lines


def print_analysis(error_input: str, language: str, matches: list[dict], stack_lines: list[str]):
    """Print formatted analysis."""
    print(f"\n{'═' * 60}")
    print(f"  OMNIDEV DEBUG ANALYSIS")
    print(f"  APEX Business Systems Ltd.")
    print(f"{'═' * 60}")
    print(f"  Language: {language.upper()}")
    print(f"{'═' * 60}\n")
    
    if stack_lines:
        print("📍 RELEVANT STACK TRACE:")
        for line in stack_lines:
            print(f"   {line}")
        print()
    
    if matches:
        for i, match in enumerate(matches, 1):
            print(f"🔍 DIAGNOSIS #{i}: {match['category']}")
            print(f"   Cause: {match['cause']}")
            print(f"   Fix:   {match['fix']}")
            print(f"\n   Example:")
            print(f"   ```")
            print(f"   {match['example']}")
            print(f"   ```\n")
    else:
        print("❓ No specific pattern matched.")
        print("   Suggestions:")
        print("   1. Check the full stack trace for the first non-library file")
        print("   2. Add logging before the failing line")
        print("   3. Verify all inputs are defined and correct type")
        print()
    
    print(f"{'═' * 60}")
    print("  Run with actual code for more specific analysis")
    print(f"{'═' * 60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="OmniDev Debug Assistant (APEX Business Systems Ltd.)",
        epilog="Analyzes errors and provides targeted fixes."
    )
    parser.add_argument(
        "input",
        nargs="?",
        help="Error message, log file path, or '-' for stdin"
    )
    parser.add_argument(
        "--lang", "-l",
        choices=["javascript", "python", "go", "rust", "java"],
        help="Force language detection"
    )
    parser.add_argument(
        "--version", "-v",
        action="version",
        version=f"OmniDev Debug v{VERSION}"
    )
    args = parser.parse_args()
    
    # Get input
    if not args.input or args.input == '-':
        if sys.stdin.isatty():
            print("Enter error message (Ctrl+D to finish):")
        content = sys.stdin.read()
    elif Path(args.input).exists():
        content = Path(args.input).read_text()
    else:
        content = args.input
    
    if not content.strip():
        print("❌ No input provided", file=sys.stderr)
        sys.exit(1)
    
    # Analyze
    language = args.lang or detect_language(content)
    matches = analyze_error(content, language)
    stack_lines = extract_stack_trace(content)
    
    # Output
    print_analysis(content, language, matches, stack_lines)
    
    sys.exit(0)


if __name__ == "__main__":
    main()
