#!/usr/bin/env python3
"""
ONE-PASS DEBUG: Evidence Analyzer
Systematically gathers and structures debugging evidence.
Exit: 0=complete, 1=incomplete evidence, 2=system error

© 2025 APEX Business Systems Ltd. Edmonton, AB, Canada.
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Any

class DebugAnalyzer:
    """Structures debugging evidence for one-pass resolution."""
    
    def __init__(self):
        self.evidence = {
            "timestamp": datetime.now().isoformat(),
            "scope": {},
            "error": {},
            "state": {},
            "code": {},
            "timeline": {},
            "hypotheses": [],
            "root_cause": None,
            "simulation": {},
            "preflight": {},
            "confidence": 0
        }
    
    def set_scope(self, 
                  broken: str,
                  expected: str, 
                  actual: str,
                  last_worked: str,
                  changed_since: str) -> None:
        """Phase 1: Lock the scope."""
        self.evidence["scope"] = {
            "broken": broken,
            "expected": expected,
            "actual": actual,
            "last_worked": last_worked,
            "changed_since": changed_since,
            "complete": all([broken, expected, actual])
        }
    
    def add_error_evidence(self,
                          stack_trace: Optional[str] = None,
                          error_message: Optional[str] = None,
                          error_code: Optional[str] = None,
                          file_path: Optional[str] = None,
                          line_number: Optional[int] = None) -> None:
        """Phase 2: Collect error evidence."""
        self.evidence["error"] = {
            "stack_trace": stack_trace,
            "error_message": error_message,
            "error_code": error_code,
            "file_path": file_path,
            "line_number": line_number,
            "complete": bool(error_message or stack_trace)
        }
    
    def add_state_evidence(self,
                          trigger_input: Optional[str] = None,
                          environment: Optional[Dict] = None,
                          variable_values: Optional[Dict] = None,
                          external_state: Optional[str] = None) -> None:
        """Phase 2: Collect state evidence."""
        self.evidence["state"] = {
            "trigger_input": trigger_input,
            "environment": environment or {},
            "variable_values": variable_values or {},
            "external_state": external_state,
            "complete": bool(trigger_input)
        }
    
    def add_code_evidence(self,
                         failing_code: Optional[str] = None,
                         related_functions: Optional[List[str]] = None,
                         recent_changes: Optional[str] = None,
                         reproduction_test: Optional[str] = None) -> None:
        """Phase 2: Collect code evidence."""
        self.evidence["code"] = {
            "failing_code": failing_code,
            "related_functions": related_functions or [],
            "recent_changes": recent_changes,
            "reproduction_test": reproduction_test,
            "complete": bool(failing_code)
        }
    
    def add_timeline_evidence(self,
                             first_appeared: Optional[str] = None,
                             frequency: Optional[str] = None,
                             trigger_conditions: Optional[List[str]] = None,
                             non_trigger_conditions: Optional[List[str]] = None) -> None:
        """Phase 2: Collect timeline evidence."""
        self.evidence["timeline"] = {
            "first_appeared": first_appeared,
            "frequency": frequency,  # always/sometimes/rare
            "trigger_conditions": trigger_conditions or [],
            "non_trigger_conditions": non_trigger_conditions or [],
            "complete": bool(first_appeared and frequency)
        }
    
    def add_hypothesis(self,
                       theory: str,
                       evidence_for: List[str],
                       evidence_against: List[str],
                       verdict: str) -> None:
        """Phase 3: Add a hypothesis to the deduction matrix."""
        self.evidence["hypotheses"].append({
            "theory": theory,
            "evidence_for": evidence_for,
            "evidence_against": evidence_against,
            "verdict": verdict  # PROVEN / ELIMINATED / NEEDS_MORE_DATA
        })
    
    def set_root_cause(self, 
                       cause: str,
                       proof: str,
                       eliminated_alternatives: List[str]) -> None:
        """Phase 3: Lock the proven root cause."""
        self.evidence["root_cause"] = {
            "cause": cause,
            "proof": proof,
            "eliminated_alternatives": eliminated_alternatives,
            "locked": True
        }
    
    def set_simulation(self,
                      fix_location: str,
                      fix_action: str,
                      execution_path_verified: bool,
                      edge_cases_checked: List[str],
                      blast_radius: str,
                      side_effects: List[str]) -> None:
        """Phase 4: Record mental simulation results."""
        self.evidence["simulation"] = {
            "fix_location": fix_location,
            "fix_action": fix_action,
            "execution_path_verified": execution_path_verified,
            "edge_cases_checked": edge_cases_checked,
            "blast_radius": blast_radius,  # none/contained/widespread
            "side_effects": side_effects,
            "complete": execution_path_verified and len(edge_cases_checked) > 0
        }
    
    def run_preflight(self) -> Dict[str, bool]:
        """Phase 5: Run pre-flight checklist."""
        checks = {
            "scope_locked": self.evidence["scope"].get("complete", False),
            "evidence_collected": all([
                self.evidence["error"].get("complete", False),
                self.evidence["state"].get("complete", False),
                self.evidence["code"].get("complete", False)
            ]),
            "root_cause_proven": self.evidence["root_cause"] is not None,
            "hypotheses_eliminated": len([
                h for h in self.evidence["hypotheses"] 
                if h["verdict"] == "ELIMINATED"
            ]) >= 2,
            "simulation_passed": self.evidence["simulation"].get("complete", False),
            "edge_cases_checked": len(
                self.evidence["simulation"].get("edge_cases_checked", [])
            ) >= 3,
            "blast_radius_known": self.evidence["simulation"].get("blast_radius") is not None,
            "fix_is_minimal": self.evidence["simulation"].get("fix_action") is not None
        }
        
        self.evidence["preflight"] = checks
        self.evidence["confidence"] = sum(checks.values()) / len(checks) * 100
        
        return checks
    
    def is_ready_to_execute(self) -> bool:
        """Check if all pre-flight checks pass."""
        if not self.evidence["preflight"]:
            self.run_preflight()
        return all(self.evidence["preflight"].values())
    
    def get_blocking_items(self) -> List[str]:
        """Get list of items blocking execution."""
        if not self.evidence["preflight"]:
            self.run_preflight()
        return [k for k, v in self.evidence["preflight"].items() if not v]
    
    def to_json(self) -> str:
        """Export evidence as JSON."""
        return json.dumps(self.evidence, indent=2)
    
    def to_markdown(self) -> str:
        """Export evidence as markdown report."""
        md = ["# ONE-PASS DEBUG: Evidence Report\n"]
        md.append(f"**Generated**: {self.evidence['timestamp']}\n")
        md.append(f"**Confidence**: {self.evidence['confidence']:.0f}%\n")
        
        # Scope
        md.append("\n## Phase 1: Scope Lock\n")
        scope = self.evidence["scope"]
        if scope:
            md.append(f"- **Broken**: {scope.get('broken', 'NOT SET')}")
            md.append(f"- **Expected**: {scope.get('expected', 'NOT SET')}")
            md.append(f"- **Actual**: {scope.get('actual', 'NOT SET')}")
            md.append(f"- **Last Worked**: {scope.get('last_worked', 'NOT SET')}")
            md.append(f"- **Changed Since**: {scope.get('changed_since', 'NOT SET')}")
        
        # Root Cause
        md.append("\n## Phase 3: Root Cause\n")
        rc = self.evidence["root_cause"]
        if rc:
            md.append(f"**PROVEN**: {rc['cause']}\n")
            md.append(f"**Proof**: {rc['proof']}\n")
            md.append(f"**Eliminated**: {', '.join(rc['eliminated_alternatives'])}")
        else:
            md.append("⛔ ROOT CAUSE NOT YET PROVEN")
        
        # Pre-flight
        md.append("\n## Phase 5: Pre-Flight Checklist\n")
        for check, passed in self.evidence["preflight"].items():
            status = "✅" if passed else "❌"
            md.append(f"{status} {check.replace('_', ' ').title()}")
        
        # Ready status
        md.append("\n## Execution Status\n")
        if self.is_ready_to_execute():
            md.append("✅ **ALL CHECKS GREEN — READY TO EXECUTE**")
        else:
            md.append("⛔ **BLOCKED — Complete these items:**")
            for item in self.get_blocking_items():
                md.append(f"  - {item.replace('_', ' ').title()}")
        
        return "\n".join(md)


def main():
    parser = argparse.ArgumentParser(
        description="ONE-PASS DEBUG: Evidence Analyzer"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        help="Output file path (default: stdout)"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["json", "markdown"],
        default="markdown",
        help="Output format (default: markdown)"
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run with demo data"
    )
    
    args = parser.parse_args()
    
    analyzer = DebugAnalyzer()
    
    if args.demo:
        # Demo: populate with example data
        analyzer.set_scope(
            broken="User login returns 500 error",
            expected="User redirected to dashboard after login",
            actual="500 Internal Server Error displayed",
            last_worked="2025-01-20 commit abc123",
            changed_since="Added rate limiting middleware"
        )
        analyzer.add_error_evidence(
            stack_trace="TypeError: Cannot read property 'id' of undefined\n  at authMiddleware (auth.js:42)",
            error_message="Cannot read property 'id' of undefined",
            file_path="src/middleware/auth.js",
            line_number=42
        )
        analyzer.add_state_evidence(
            trigger_input="POST /login with valid credentials",
            environment={"NODE_ENV": "production", "version": "2.1.0"},
            variable_values={"user": "undefined", "session": "valid"}
        )
        analyzer.add_code_evidence(
            failing_code="const userId = user.id; // user is undefined here",
            related_functions=["validateSession", "createToken"],
            recent_changes="+ rateLimiter middleware added before auth"
        )
        analyzer.add_timeline_evidence(
            first_appeared="2025-01-21 14:30 UTC",
            frequency="always",
            trigger_conditions=["Any login attempt"],
            non_trigger_conditions=["API health check"]
        )
        analyzer.add_hypothesis(
            theory="Rate limiter middleware runs before user is attached",
            evidence_for=["Middleware order in app.js", "User undefined at line 42"],
            evidence_against=[],
            verdict="PROVEN"
        )
        analyzer.add_hypothesis(
            theory="Database connection timeout",
            evidence_for=[],
            evidence_against=["DB logs show successful queries", "Other endpoints work"],
            verdict="ELIMINATED"
        )
        analyzer.add_hypothesis(
            theory="Session corruption",
            evidence_for=[],
            evidence_against=["Session valid in state", "Works in staging"],
            verdict="ELIMINATED"
        )
        analyzer.set_root_cause(
            cause="Rate limiter middleware placed before auth middleware, user not attached yet",
            proof="Middleware order: [rateLimiter, auth, routes]. Auth expects user from previous middleware.",
            eliminated_alternatives=["DB timeout", "Session corruption"]
        )
        analyzer.set_simulation(
            fix_location="src/app.js:15",
            fix_action="Move rateLimiter after auth middleware",
            execution_path_verified=True,
            edge_cases_checked=[
                "Rate limit still works after auth",
                "Unauthenticated routes still rate limited",
                "No performance regression"
            ],
            blast_radius="contained",
            side_effects=[]
        )
    
    analyzer.run_preflight()
    
    # Output
    if args.format == "json":
        output = analyzer.to_json()
    else:
        output = analyzer.to_markdown()
    
    if args.output:
        args.output.write_text(output)
        print(f"✅ Report written to {args.output}")
    else:
        print(output)
    
    # Exit code based on readiness
    sys.exit(0 if analyzer.is_ready_to_execute() else 1)


if __name__ == "__main__":
    main()
