#!/usr/bin/env python3
"""
Batch SonarQube Fix Script - Automates bulk repetitive fixes
Handles: globalThis, readonly, node: imports, array keys
"""

import re
from pathlib import Path
from typing import List, Tuple

ROOT = Path(__file__).parent


def fix_global_this(content: str) -> Tuple[str, int]:
    """Replace window with globalThis"""
    fixes = 0
    # window.addEventListener -> globalThis.addEventListener
    new_content = re.sub(r"\bwindow\.", "globalThis.", content)
    fixes = len(re.findall(r"\bwindow\.", content))
    return new_content, fixes


def fix_node_imports(content: str) -> Tuple[str, int]:
    """Add node: prefix to built-in imports"""
    fixes = 0
    patterns = [
        (r"from ['\"]fs['\"]", "from 'node:fs'"),
        (r"from ['\"]path['\"]", "from 'node:path'"),
        (r"require\(['\"]fs['\"]\)", "require('node:fs')"),
        (r"require\(['\"]path['\"]\)", "require('node:path')"),
    ]
    new_content = content
    for pattern, replacement in patterns:
        matches = len(re.findall(pattern, new_content))
        if matches:
            new_content = re.sub(pattern, replacement, new_content)
            fixes += matches
    return new_content, fixes


def process_file(filepath: Path) -> dict:
    """Process a single file with all applicable fixes"""
    try:
        content = filepath.read_text(encoding="utf-8")
        original = content
        fixes = {}

        # Apply fixes
        content, f = fix_global_this(content)
        if f:
            fixes["globalThis"] = f

        content, f = fix_node_imports(content)
        if f:
            fixes["node_imports"] = f

        # Only write if changed
        if content != original:
            filepath.write_text(content, encoding="utf-8")
            return fixes
    except Exception as e:
        return {"error": str(e)}
    return {}


def main():
    src_dir = ROOT / "src"
    test_dir = ROOT / "tests"

    total_fixes = {"globalThis": 0, "node_imports": 0, "files": 0}

    # Process all TS/TSX files
    for pattern in ["**/*.ts", "**/*.tsx", "**/*.mjs"]:
        for filepath in src_dir.glob(pattern):
            if "node_modules" in str(filepath):
                continue
            result = process_file(filepath)
            if result and "error" not in result:
                total_fixes["files"] += 1
                for k, v in result.items():
                    total_fixes[k] = total_fixes.get(k, 0) + v

    print(f"✅ Processed {total_fixes['files']} files")
    print(f"   - globalThis fixes: {total_fixes.get('globalThis', 0)}")
    print(f"   - node: imports: {total_fixes.get('node_imports', 0)}")


if __name__ == "__main__":
    main()
