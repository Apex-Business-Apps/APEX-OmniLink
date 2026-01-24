# ONE-PASS DEBUG

**Omniscient Zero-Iteration Debugging Protocol**

> *"NEVER touch code until you're 1000% certain. Simulate first. Execute once. Done."*

---

## What This Is

A debugging methodology that eliminates guess-and-check loops entirely. Instead of iterative debugging where you try things until something works, this protocol ensures you understand the bug completely BEFORE making any code changes.

**Result**: Single surgical fixes with zero rollback needed.

---

## Installation

### Claude AI (Skills Framework)
1. Copy the `one-pass-debug/` folder to your skills directory
2. The skill auto-activates on triggers: `debug`, `fix bug`, `error`, `crash`, `failing test`, `broken`, `not working`, `exception`, `stack trace`, `troubleshoot`, `diagnose`

### Other LLMs
1. Copy the contents of `SKILL.md` into your system prompt or context
2. Reference `references/patterns.md` when diagnosing bugs
3. Use `references/checklist.md` as a working template

### Human Developers
1. Print `references/checklist.md`
2. Use it for every debugging session
3. Don't skip steps (that's how loops happen)

---

## Quick Start

When you encounter a bug:

1. **SCOPE LOCK** (2 min) - Define exactly what's broken
2. **CONTEXT HARVEST** (5-15 min) - Gather ALL evidence
3. **ROOT CAUSE DEDUCTION** - Prove ONE cause, eliminate rest
4. **MENTAL SIMULATION** - Run the fix in your mind first
5. **PRE-FLIGHT** - Verify ALL checks green
6. **SURGICAL EXECUTION** - One precise change
7. **CLOSURE** - Prevent recurrence, document

**Golden Rule**: Code changes are BLOCKED until pre-flight checklist is 100% green.

---

## File Structure

```
one-pass-debug/
├── SKILL.md           # Core methodology (load always)
├── scripts/
│   └── analyze.py     # Evidence structuring tool
├── references/
│   ├── patterns.md    # Bug pattern library (load on-demand)
│   └── checklist.md   # Printable working checklist
└── README.md          # This file
```

---

## Key Differentiators

| Traditional Debugging | ONE-PASS DEBUG |
|-----------------------|----------------|
| Change code to see what happens | Change code only when certain |
| Multiple attempts common | Single attempt by design |
| "Let me try this" | "I have proven this" |
| Time grows with complexity | Time bounded by methodology |
| Success rate varies | Success rate approaches 100% |

---

## Scripts

### analyze.py

Structures debugging evidence systematically:

```bash
# Run with demo data
python scripts/analyze.py --demo

# Output as JSON
python scripts/analyze.py --demo --format json

# Save to file
python scripts/analyze.py --demo --output report.md
```

---

## Integration

Works with any:
- Programming language
- Framework
- Runtime environment
- Deployment target
- Team size

The protocol targets the DEBUG PROCESS, not the technology being debugged.

---

## License

© 2025 APEX Business Systems Ltd.
Edmonton, AB, Canada

Proprietary. All rights reserved.

Licensed for use within AI skills frameworks (Claude, GPT, etc.) and internal development teams.

---

## Support

For issues, enhancements, or licensing inquiries:
- Website: https://apexbusiness-systems.com
- Location: Edmonton, AB, Canada
