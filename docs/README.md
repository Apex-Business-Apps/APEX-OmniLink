# APEX OmniHub Documentation

**Enterprise AI Orchestration Platform**

---

## Quick Navigation

| Category | Description |
|----------|-------------|
| [Platform Modules](#platform-modules) | Core Omni-* module documentation |
| [Architecture](#architecture) | System design and technical specifications |
| [Infrastructure](#infrastructure) | Deployment, cloud, and DevOps |
| [Operations](#operations) | Runbooks and operational procedures |
| [Security](#security) | Security controls and policies |
| [Compliance](#compliance) | SOC2, GDPR, audit readiness |
| [Testing](#testing) | Test results and simulation |
| [Audits](#audits) | Audit reports and remediation |

---

## Platform Modules

Core platform components with dedicated documentation:

| Module | Description | Documentation |
|--------|-------------|---------------|
| **OmniTrace** | Workflow observability & replay | [OMNITRACE.md](platform/OMNITRACE.md) |
| **OmniPolicy** | Deterministic policy evaluation | [OMNIPOLICY.md](platform/OMNIPOLICY.md) |
| **OmniEval** | Security evaluation & CI gate | [OMNIEVAL.md](platform/OMNIEVAL.md) |
| **OmniPort** | Ingress engine & API | [OMNIPORT_API_REFERENCE.md](platform/OMNIPORT_API_REFERENCE.md) |
| **OmniDash** | Executive dashboard | [OMNIDASH.md](platform/OMNIDASH.md) |
| **OmniLink** | Integration bus | [OMNILINK_MANIFESTO_LITE.md](platform/OMNILINK_MANIFESTO_LITE.md) |
| **Connector Kit** | Integration adapters | [CONNECTOR_KIT.md](platform/CONNECTOR_KIT.md) |

---

## Architecture

System design and technical specifications:

| Document | Description |
|----------|-------------|
| [Technical Architecture](architecture/TECH_SPEC_ARCHITECTURE.md) | Complete system design |
| [Architecture Convergence](architecture/ARCHITECTURAL_CONVERGENCE_REPORT.md) | Architecture decisions |
| [MAN Mode Workflows](architecture/MAN_MODE_WORKFLOW_DIAGRAMS.md) | Human-in-the-loop flows |
| [OmniLink Architecture](architecture/OMNILINK_ARCHITECTURE_OUTPUT.md) | Integration bus design |
| [Technical Enhancements](architecture/TECHNICAL_ENHANCEMENTS.md) | Recent improvements |
| [Production Status](architecture/PRODUCTION_STATUS.md) | Current deployment state |
| [Launch Readiness](architecture/LAUNCH_READINESS.md) | Launch checklist |
| [Ecosystem Status](architecture/APEX_ECOSYSTEM_STATUS.md) | Platform overview |

---

## Infrastructure

Deployment, cloud infrastructure, and DevOps:

| Document | Description |
|----------|-------------|
| [Architecture Summary](infrastructure/ARCHITECTURE_SUMMARY.md) | Infrastructure overview |
| [Production Deployment](infrastructure/PRODUCTION_DEPLOYMENT_GUIDE.md) | Deployment guide |
| [CI/CD Pipeline](infrastructure/CICD_PIPELINE_DESIGN.md) | Pipeline design |
| [CI Runtime Gates](infrastructure/CI_RUNTIME_GATES.md) | Quality gates |
| [Disaster Recovery](infrastructure/DISASTER_RECOVERY_PLAN.md) | DR procedures |
| [Cloud Agnostic](infrastructure/CLOUD_AGNOSTIC_ARCHITECTURE.md) | Multi-cloud support |
| [Observability Stack](infrastructure/OBSERVABILITY_STACK_SETUP.md) | Monitoring setup |
| [Blockchain Config](infrastructure/BLOCKCHAIN_CONFIG.md) | Web3 configuration |
| [Cost Optimization](infrastructure/COST_OPTIMIZATION.md) | Cost management |
| [Backup Verification](infrastructure/BACKUP_VERIFICATION.md) | Backup procedures |

### Deployment Paths
| Document | Description |
|----------|-------------|
| [Path A: Serverless](infrastructure/PATH_A_ENHANCED_SERVERLESS.md) | Serverless deployment |
| [Path B: Containerized](infrastructure/PATH_B_CONTAINERIZED_MULTICLOUD.md) | Container deployment |

### Migration
| Document | Description |
|----------|-------------|
| [Migration Notes](infrastructure/MIGRATION_NOTES.md) | Migration guidance |
| [Migration Runbook](infrastructure/MIGRATION_RUNBOOK.md) | Migration procedures |

---

## Operations

Operational runbooks and procedures:

| Document | Description |
|----------|-------------|
| [Operations Runbook](ops/OPS_RUNBOOK.md) | Master ops runbook (v2.0) |
| [Ops Audit](ops/OPS_AUDIT.md) | Operations audit |
| [Adaptive Nightly Eval](ops/adaptive-nightly-eval.md) | Automated evaluation |

### Recovery Guides
| Document | Description |
|----------|-------------|
| [DR Runbook](guides/DR_RUNBOOK.md) | Disaster recovery |
| [Web3 Verification](guides/WEB3_VERIFICATION_RUNBOOK.md) | Blockchain verification |

---

## Security

Security controls, policies, and hardening:

| Document | Description |
|----------|-------------|
| [Secrets Manager Setup](security/SECRETS_MANAGER_SETUP.md) | Secrets management |
| [Secrets Inventory](security/SECRETS_INVENTORY_AND_ROTATION.md) | Secret rotation |
| [Secret Scanning](security/SECRET_SCANNING.md) | Scanning policies |
| [Zero Trust Baseline](security/zero-trust-baseline.md) | Zero trust model |
| [Prompt Defense](security/prompt-defense-tuning.md) | AI security |
| [Device Registry](security/device-registry.md) | Device management |
| [Dependency Scanning](security/dependency-scanning.md) | Vulnerability scanning |
| [ENV Exposure Advisory](security/ENV_FILE_EXPOSURE_ADVISORY.md) | Environment security |

---

## Compliance

Regulatory compliance and audit readiness:

| Document | Description |
|----------|-------------|
| [SOC2 Readiness](compliance/SOC2_READINESS.md) | SOC2 compliance |
| [GDPR Compliance](compliance/GDPR_COMPLIANCE.md) | Data protection |
| [Evidence Checklist](compliance/EVIDENCE_CHECKLIST.md) | Audit evidence |

---

## Testing

Test results, simulation, and quality assurance:

| Document | Description |
|----------|-------------|
| [E2E Test Results](testing/E2E_TEST_RESULTS.md) | End-to-end test status |
| [Wildcard Tests](testing/worldwide-wildcard-tests.md) | Edge case testing |

### Chaos Simulation
| Document | Description |
|----------|-------------|
| [Simulation Architecture](sim/ARCHITECTURE.md) | Chaos framework design |
| [Chaos Delivery](sim/CHAOS_SIMULATION_DELIVERY.md) | Delivery report |
| [Simulation Runbook](sim/RUNBOOK.md) | How to run simulations |
| [Client Story](sim/CHAOTIC_CLIENT_STORY.md) | Test scenario |
| [Results Report](sim/RESULTS_REPORT.md) | Simulation results |
| [Test Execution](sim/TEST_EXECUTION_REPORT.md) | Execution details |

---

## Audits

Audit reports, remediation, and historical records:

| Document | Description |
|----------|-------------|
| [Platform Audit 2026-01-10](audits/PLATFORM_AUDIT_2026_01_10.md) | Full platform audit |
| [Remediation Tracker](audits/REMEDIATION_TRACKER.md) | Issue tracking |
| [Remediation Evidence](audits/REMEDIATION_EVIDENCE.md) | Fix evidence |
| [Battery Test Report](audits/BATTERY_TEST_REPORT.md) | Stress test results |
| [Armageddon Test](audits/ARMAGEDDON_TEST_SUITE_REPORT.md) | Extreme testing |
| [Production Blockers](audits/PRODUCTION_BLOCKERS_ANALYSIS.md) | Blocker analysis |
| [Web3 Integration](audits/WEB3_INTEGRATION_COMPLETE.md) | Blockchain audit |
| [Voice Fortress Audit](audits/VOICE_FORTRESS_TELEMETRY_AUDIT.md) | Voice security |
| [Sonar Duplication](audits/sonar-duplication-map.md) | Code quality |

---

## Document Standards

### Naming Convention
- `UPPERCASE_WITH_UNDERSCORES.md` for formal documents
- `lowercase-with-dashes.md` for informal/working documents

### Structure
```
docs/
├── README.md                 # This index
├── platform/                 # Core Omni-* modules
├── architecture/             # System design
├── infrastructure/           # DevOps & cloud
├── ops/                      # Operations
├── security/                 # Security controls
├── compliance/               # Regulatory
├── testing/                  # QA & testing
├── sim/                      # Chaos simulation
├── audits/                   # Audit reports
└── guides/                   # How-to guides
```

---

**Last Updated:** January 25, 2026
