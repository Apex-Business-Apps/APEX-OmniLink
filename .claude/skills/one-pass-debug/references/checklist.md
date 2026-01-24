# ONE-PASS DEBUG: Quick Reference Checklist

> **Print this. Use this. Zero guessing.**

© 2025 APEX Business Systems Ltd. Edmonton, AB, Canada.

---

## PRE-EXECUTION CHECKLIST

Copy and fill before touching ANY code:

```
═══════════════════════════════════════════════════════════════════
                     ONE-PASS DEBUG CHECKLIST
═══════════════════════════════════════════════════════════════════

PHASE 1: SCOPE LOCK
□ Broken: ________________________________________________
□ Expected: ______________________________________________
□ Actual: ________________________________________________
□ Last worked: ___________________________________________
□ Changed since: _________________________________________

PHASE 2: EVIDENCE COLLECTED
□ Full stack trace captured
□ Exact error message (copy-paste)
□ Input that triggers bug
□ Environment documented
□ Variable values at crash point
□ Failing code identified (file:line)
□ Reproduction steps confirmed

PHASE 3: ROOT CAUSE
Hypothesis 1: ____________________________________________
  Evidence for: __________________________________________
  Evidence against: ______________________________________
  Verdict: □ PROVEN  □ ELIMINATED  □ NEEDS DATA

Hypothesis 2: ____________________________________________
  Evidence for: __________________________________________
  Evidence against: ______________________________________
  Verdict: □ PROVEN  □ ELIMINATED  □ NEEDS DATA

Hypothesis 3: ____________________________________________
  Evidence for: __________________________________________
  Evidence against: ______________________________________
  Verdict: □ PROVEN  □ ELIMINATED  □ NEEDS DATA

ROOT CAUSE (ONE remaining): ______________________________
Proof: __________________________________________________

PHASE 4: SIMULATION
□ Fix location: __________________________________________
□ Fix action: ____________________________________________
□ Execution path traced mentally
□ Edge cases checked:
  □ Null/empty input
  □ Maximum size input
  □ Multiple calls
  □ Concurrent access
  □ Error conditions
□ Blast radius: □ None  □ Contained  □ Widespread
□ Side effects: __________________________________________

PHASE 5: PRE-FLIGHT (ALL must be checked)
□ Scope locked (no creep)
□ All evidence collected
□ Root cause PROVEN (not assumed)
□ Other hypotheses ELIMINATED
□ Mental simulation passed
□ Edge cases verified
□ Blast radius known
□ Fix is minimal
□ Fix is surgical
□ Rollback plan ready

═══════════════════════════════════════════════════════════════════
⛔ DO NOT PROCEED UNTIL ALL BOXES CHECKED ⛔
═══════════════════════════════════════════════════════════════════

PHASE 6: EXECUTION
Fix applied at: __________________________________________
Change summary: __________________________________________

PHASE 7: VALIDATION
□ Bug reproduction test passes
□ All existing tests pass
□ Manual verification done
□ Edge cases from simulation verified
□ No new warnings/errors

CLOSURE
□ Root cause documented
□ Regression test added
□ Related code reviewed for same pattern
□ Knowledge shared with team

═══════════════════════════════════════════════════════════════════
                        BUG RESOLVED ✓
═══════════════════════════════════════════════════════════════════
```

---

## QUICK DIAGNOSIS PROMPTS

### When stuck on Phase 3:

1. "What would be TRUE if my hypothesis is correct?"
2. "What would BREAK if my hypothesis is wrong?"
3. "What EVIDENCE would prove this beyond doubt?"
4. "What's the SIMPLEST explanation that fits ALL facts?"
5. "If I were betting money, what would I bet on and why?"

### When simulation reveals gaps:

1. "What happens if this is called with NULL?"
2. "What happens if this is called 1000 times?"
3. "What happens if two users do this simultaneously?"
4. "What happens if the network fails mid-operation?"
5. "What other code depends on this function?"

### When tempted to skip:

**STOP. Ask yourself:**
- "Am I 100% certain, or am I guessing?"
- "If I'm wrong, how long will I spend debugging my fix?"
- "Would I bet $1000 on this diagnosis?"

If any doubt → Go back. Gather more evidence.

---

## FORBIDDEN PHRASES

If you hear yourself saying these, STOP:

| Phrase | Problem | Action |
|--------|---------|--------|
| "Let me try this" | Guessing | Back to Phase 3 |
| "It might be" | Uncertainty | Back to Phase 2 |
| "I think" | Opinion, not proof | Find evidence |
| "It should work" | Hope, not verification | Test first |
| "I've seen this before" | Pattern without proof | Verify it matches |
| "Quick fix" | Symptom, not root cause | Find root cause |

---

## TIME INVESTMENT GUIDE

| Bug Complexity | Phase 1-2 | Phase 3 | Phase 4-5 | Phase 6-7 |
|----------------|-----------|---------|-----------|-----------|
| Simple | 2 min | 5 min | 3 min | 5 min |
| Medium | 5 min | 15 min | 10 min | 10 min |
| Complex | 15 min | 30 min | 15 min | 15 min |
| Critical | 30 min | 60 min | 30 min | 30 min |

**Key insight**: Time spent in Phase 3-4 SAVES time overall. Rushing to Phase 6 creates loops.

---

## EMERGENCY OVERRIDE

Only skip phases if ALL true:
- Production is DOWN
- Users are affected NOW
- Temporary mitigation needed ASAP

Even then:
1. Apply temporary mitigation ONLY
2. Document what you changed
3. Return to Phase 1 after mitigation
4. Find and fix ROOT CAUSE properly

**A temporary fix is NOT a resolution. Schedule the real fix.**
