#!/usr/bin/env python3
"""
Debug Helper - Systematic debugging assistance

Copyright (c) 2025 APEX Business Systems Ltd.
Edmonton, AB, Canada | https://apexbusiness-systems.com

Usage: python debug-helper.py <error-file> [--analyze]

Analyzes error messages and stack traces to suggest fixes.
Exit: 0=success, 1=input error, 2=system error
"""
import argparse
import re
import sys
from pathlib import Path

# Common error patterns and fixes
ERROR_PATTERNS: dict[str, dict] = {
    # Python errors
    r"ModuleNotFoundError: No module named '(\w+)'": {
        "type": "Missing dependency",
        "fix": "pip install {0}",
        "check": "Verify package name, check virtual environment activation",
    },
    r"ImportError: cannot import name '(\w+)' from '(\w+)'": {
        "type": "Import error",
        "fix": "Check {0} exists in {1}, verify version compatibility",
        "check": "pip show {1}",
    },
    r"KeyError: ['\"]?(\w+)['\"]?": {
        "type": "Missing dictionary key",
        "fix": "Use .get('{0}', default) or check key existence",
        "check": "Add: if '{0}' in data: ...",
    },
    r"TypeError: .+ takes (\d+) positional arguments? but (\d+) (?:was|were) given": {
        "type": "Wrong number of arguments",
        "fix": "Expected {0} args, got {1}. Check function signature",
        "check": "Review function definition and call site",
    },
    r"AttributeError: '(\w+)' object has no attribute '(\w+)'": {
        "type": "Missing attribute",
        "fix": "{0} doesn't have {1}. Check spelling, object type",
        "check": "print(type(obj), dir(obj))",
    },
    r"ValueError: invalid literal for int\(\) with base (\d+): ['\"](.+)['\"]": {
        "type": "Invalid conversion",
        "fix": "Cannot convert '{1}' to int. Validate input first",
        "check": "if value.isdigit(): int(value)",
    },
    r"ConnectionRefusedError|ConnectionError": {
        "type": "Connection failed",
        "fix": "Check service is running, correct host/port",
        "check": "curl -v http://localhost:PORT/health",
    },
    r"TimeoutError|asyncio\.TimeoutError": {
        "type": "Operation timeout",
        "fix": "Increase timeout, check network, optimize query",
        "check": "Add retry logic with exponential backoff",
    },
    
    # JavaScript/Node errors
    r"TypeError: Cannot read propert(?:y|ies) of (undefined|null)": {
        "type": "Null reference",
        "fix": "Object is {0}. Add null check: obj?.property",
        "check": "console.log(obj) before access",
    },
    r"ReferenceError: (\w+) is not defined": {
        "type": "Undefined variable",
        "fix": "{0} not declared. Check spelling, imports, scope",
        "check": "Ensure variable is declared before use",
    },
    r"SyntaxError: Unexpected token": {
        "type": "Syntax error",
        "fix": "Check for missing brackets, commas, or quotes",
        "check": "Run: eslint --fix file.js",
    },
    
    # Database errors
    r"(duplicate key|unique constraint|UNIQUE constraint failed)": {
        "type": "Duplicate key violation",
        "fix": "Record already exists. Use upsert or check before insert",
        "check": "SELECT * FROM table WHERE key = value",
    },
    r"(foreign key constraint|FOREIGN KEY constraint failed)": {
        "type": "Foreign key violation",
        "fix": "Referenced record doesn't exist. Insert parent first",
        "check": "Verify parent record exists before insert",
    },
    r"(deadlock|lock wait timeout)": {
        "type": "Database lock issue",
        "fix": "Transactions conflicting. Use shorter transactions, retry",
        "check": "SHOW PROCESSLIST; or pg_stat_activity",
    },
    
    # HTTP errors
    r"HTTP (\d{3})": {
        "type": "HTTP error",
        "fix": "Status {0}: Check API docs, auth, request format",
        "check": "curl -v URL to see full request/response",
    },
    r"CORS|Access-Control-Allow-Origin": {
        "type": "CORS error",
        "fix": "Add CORS headers to server response",
        "check": "Configure CORS middleware with allowed origins",
    },
}


def analyze_error(text: str) -> list[tuple[str, dict]]:
    """Analyze error text and return matching patterns."""
    matches = []
    for pattern, info in ERROR_PATTERNS.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            # Format fix message with captured groups
            fix = info["fix"]
            check = info["check"]
            if match.groups():
                fix = fix.format(*match.groups())
                check = check.format(*match.groups())
            
            matches.append((info["type"], {
                "pattern": pattern,
                "fix": fix,
                "check": check,
                "match": match.group(0)
            }))
    
    return matches


def extract_stacktrace(text: str) -> list[str]:
    """Extract file locations from stack trace."""
    locations = []
    # Python style
    py_pattern = r'File "([^"]+)", line (\d+)'
    for match in re.finditer(py_pattern, text):
        locations.append(f"{match.group(1)}:{match.group(2)}")
    
    # JavaScript style
    js_pattern = r'at .+ \(([^)]+):(\d+):\d+\)'
    for match in re.finditer(js_pattern, text):
        locations.append(f"{match.group(1)}:{match.group(2)}")
    
    return locations


def main():
    parser = argparse.ArgumentParser(
        description="Analyze errors and suggest fixes (APEX Business Systems Ltd.)"
    )
    parser.add_argument("input", nargs="?", help="Error file or text")
    parser.add_argument("--analyze", action="store_true", help="Detailed analysis")
    args = parser.parse_args()
    
    # Read error text
    if args.input:
        path = Path(args.input)
        if path.exists():
            text = path.read_text()
        else:
            text = args.input
    else:
        text = sys.stdin.read()
    
    if not text.strip():
        print("❌ No error text provided", file=sys.stderr)
        sys.exit(1)
    
    print("\n🔍 Debug Analysis")
    print("=" * 60)
    
    # Analyze errors
    matches = analyze_error(text)
    
    if not matches:
        print("⚠️  No known patterns matched")
        print("\nGeneral debugging steps:")
        print("1. Read the error message carefully")
        print("2. Check the stack trace for the source location")
        print("3. Add logging around the error location")
        print("4. Search the error message online")
    else:
        for error_type, info in matches:
            print(f"\n🎯 {error_type}")
            print(f"   Match: {info['match']}")
            print(f"   Fix: {info['fix']}")
            print(f"   Check: {info['check']}")
    
    # Extract locations
    locations = extract_stacktrace(text)
    if locations:
        print("\n📍 Stack trace locations:")
        for loc in locations[:5]:
            print(f"   {loc}")
    
    print("\n" + "=" * 60)
    print("© 2025 APEX Business Systems Ltd.")


if __name__ == "__main__":
    main()
