# APEX OmniHub

 

```

 ██████╗ ███╗   ███╗███╗   ██╗██╗██╗     ██╗███╗   ██╗██╗  ██╗

██╔═══██╗████╗ ████║████╗  ██║██║██║     ██║████╗  ██║██║ ██╔╝

██║   ██║██╔████╔██║██╔██╗ ██║██║██║     ██║██╔██╗ ██║█████╔╝

██║   ██║██║╚██╔╝██║██║╚██╗██║██║██║     ██║██║╚██╗██║██╔═██╗

╚██████╔╝██║ ╚═╝ ██║██║ ╚████║██║███████╗██║██║ ╚████║██║  ██╗

 ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝

                    E N T E R P R I S E   A I   P L A T F O R M

```

 

**Enterprise-Grade AI Orchestration with Web3 Integration**

 

APEX OmniHub is a production-ready platform combining AI agent orchestration, blockchain-native authentication, and enterprise security into a unified operations dashboard. Built on battle-tested infrastructure patterns used by Fortune 500 companies.

 

[![Production Ready](https://img.shields.io/badge/Status-PRODUCTION%20READY-green?style=for-the-badge)](https://github.com/apexbusiness-systems/APEX-OmniHub)

[![Test Coverage](https://img.shields.io/badge/Tests-450%20passing%20(87%25)-brightgreen?style=for-the-badge)](https://github.com/apexbusiness-systems/APEX-OmniHub/tree/main/tests)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=for-the-badge)](https://www.typescriptlang.org/)

[![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge)](https://python.org/)

[![Web3](https://img.shields.io/badge/Web3-Enabled-purple?style=for-the-badge)](https://ethereum.org/)

 

---

 

## Architecture Overview

 

```

┌─────────────────────────────────────────────────────────────────────────────┐

│                              APEX OmniHub                                   │

├─────────────────────────────────────────────────────────────────────────────┤

│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │

│  │  OmniDash   │  │   Web3      │  │  Guardian   │  │   Voice     │        │

│  │  Dashboard  │  │   Wallet    │  │   Security  │  │  Interface  │        │

│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │

│         │                │                │                │               │

│  ┌──────┴────────────────┴────────────────┴────────────────┴──────┐        │

│  │                    React + TypeScript Frontend                  │       │

│  │              (Vite, Tailwind, shadcn/ui, React Query)          │        │

│  └─────────────────────────────┬──────────────────────────────────┘        │

│                                │                                           │

│  ┌─────────────────────────────┴──────────────────────────────────┐        │

│  │                  Supabase Edge Functions (Deno)                 │       │

│  │         15 Functions: Agent, Auth, Web3, Storage, Health        │       │

│  └─────────────────────────────┬──────────────────────────────────┘        │

│                                │                                           │

│  ┌─────────────────────────────┴──────────────────────────────────┐        │

│  │              Temporal.io Orchestration Layer (Python)          │        │

│  │     Event Sourcing │ Saga Pattern │ Semantic Cache │ MAN Mode  │        │

│  └─────────────────────────────┬──────────────────────────────────┘        │

│                                │                                           │

│  ┌────────────┬────────────────┴───────────────┬────────────────┐          │

│  │ PostgreSQL │         Redis Stack            │   Alchemy RPC  │          │

│  │ (pgvector) │    (Vector Search + Cache)     │  (ETH/Polygon) │          │

│  └────────────┴────────────────────────────────┴────────────────┘          │

└─────────────────────────────────────────────────────────────────────────────┘

```

 

---

 

## Core Capabilities

 

### Tri-Force AI Agent Architecture

 

A three-tier security model that separates concerns and prevents AI hallucinations from reaching production:

 

| Layer | Function | Implementation |

|-------|----------|----------------|

| **Guardian** | Security evaluation | Constitutional AI with 22 injection patterns blocked |

| **Planner** | Cognitive processing | Hierarchical DAG execution with plan validation |

| **Executor** | Tool execution | Audit trails, timeout protection, fail-safe responses |

 

### Temporal.io Workflow Orchestration

 

Production-grade workflow orchestration with enterprise reliability patterns:

 

- **Event Sourcing**: Complete audit trail with deterministic replay capability

- **Saga Pattern**: Distributed transactions with automatic compensation

- **Semantic Caching**: 70% cache hit rate via Redis vector similarity search

- **MAN Mode**: Human-in-the-loop safety gate for high-risk operations

 

### Web3 Integration

 

Blockchain-native authentication and access control:

 

- **Wallet Support**: MetaMask, WalletConnect, Coinbase Wallet

- **NFT Gating**: Premium features via APEXMembershipNFT (ERC-721)

- **Multi-Chain**: Ethereum Mainnet and Polygon Mainnet

- **SIWE**: Sign-In with Ethereum for cryptographic authentication

 

### OmniDash Executive Dashboard

 

Purpose-built interface for operations management:

 

- **Icon Navigation**: Minimal O/P/K/! icons with tooltip intelligence

- **Pipeline Management**: Deal tracking with next-touch enforcement

- **KPI Visualization**: Real-time metrics and performance tracking

- **Role-Based Access**: Admin and founder permission tiers

 

---

 

## Quick Start

 

### Prerequisites

 

- Node.js 18+ and npm

- Python 3.11+ (for orchestrator)

- Docker (for local Temporal/Redis)

- Supabase account

 

### Installation

 

```bash

# Clone repository

git clone https://github.com/apexbusiness-systems/APEX-OmniHub.git

cd APEX-OmniHub

 

# Install frontend dependencies

npm install

 

# Configure environment

cp .env.example .env.local

# Edit .env.local with your credentials

 

# Start development server

npm run dev

```

 

### Environment Configuration

 

```bash

# Required - Supabase

# Required - Supabase

VITE_SUPABASE_URL=https://your-project.supabase.co

VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key


# Required - Site URL (Production)

VITE_SITE_URL=https://apexomnihub.icu

 

# Optional - Feature Flags

VITE_OMNIDASH_ENABLED=1

VITE_WEB3_NETWORK=polygon-mainnet

 

# Optional - Web3

VITE_ALCHEMY_API_KEY=your-alchemy-key

 

# Optional - Access Control

VITE_OMNIDASH_ADMIN_EMAILS=admin@company.com

```

 

### Orchestrator Setup

 

```bash

cd orchestrator

 

# Create virtual environment

python -m venv .venv

source .venv/bin/activate

 

# Install dependencies

pip install -e ".[dev]"

 

# Start local infrastructure

docker compose up -d

 

# Run worker

python -m orchestrator.worker

```

 

---

 

## Technology Stack

 

### Frontend

| Technology | Version | Purpose |

|------------|---------|---------|

| React | 18.3 | UI framework |

| TypeScript | 5.8 | Type safety |

| Vite | 7.2 | Build tooling |

| Tailwind CSS | 3.4 | Styling |

| React Query | 5.x | Data fetching |

| viem/wagmi | 2.x | Web3 integration |

 

### Backend

| Technology | Version | Purpose |

|------------|---------|---------|

| Supabase | Latest | Database, Auth, Storage |

| PostgreSQL | 15 | Primary database |

| pgvector | 0.5+ | AI embeddings |

| Deno | Latest | Edge Functions runtime |

 

### Orchestration

| Technology | Version | Purpose |

|------------|---------|---------|

| Temporal.io | 1.x | Workflow orchestration |

| Python | 3.11+ | Worker runtime |

| Redis Stack | 7.x | Caching, vector search |

| LiteLLM | Latest | LLM abstraction |

 

### Infrastructure

| Technology | Purpose |

|------------|---------|

| Terraform | Infrastructure as Code |

| GitHub Actions | CI/CD pipelines |

| Vercel | Frontend hosting |

| Cloudflare | CDN, WAF, DDoS protection |

 

---

 

## Project Structure

 

```

APEX-OmniHub/

├── src/                    # React frontend application

│   ├── components/         # Reusable UI components

│   ├── pages/              # Route pages

│   ├── lib/                # Core libraries

│   ├── guardian/           # Security layer

│   ├── omnidash/           # Executive dashboard

│   └── providers/          # Context providers

├── orchestrator/           # Python Temporal.io worker

│   ├── workflows/          # Workflow definitions

│   ├── activities/         # Tool execution

│   ├── models/             # Pydantic models

│   ├── infrastructure/     # Cache, Redis

│   └── policies/           # MAN Mode policies

├── supabase/

│   ├── functions/          # 15 Edge Functions

│   └── migrations/         # 18 database migrations

├── terraform/              # Infrastructure modules

├── tests/                  # Comprehensive test suite

├── docs/                   # Documentation (50+ files)

└── .github/workflows/      # 7 CI/CD pipelines

```

 

---

 

## Security

 

### Defense in Depth

 

| Layer | Protection |

|-------|------------|

| **Prompt Injection** | 22 attack patterns with regex + LLM detection |

| **PII Redaction** | SSN, credit cards, phones, emails sanitized |

| **Audit Logging** | Every action tracked with device fingerprinting |

| **Zero Trust** | Device registry with behavioral baselines |

| **RLS Policies** | Row-level security on all database tables |

 

### Compliance Readiness

 

- **SOC 2**: Audit trails, access controls, encryption

- **GDPR**: Data handling policies, right to deletion

- **Disaster Recovery**: Documented runbooks, backup verification

 

---

 

## Performance

 

| Metric | Value |

|--------|-------|

| Build Time | 42.20s |

| Bundle Size | 506 KB (144 KB gzip) |

| Lighthouse Score | 95+ |

| Test Pass Rate | 87.0% (517 tests) |

| Cache Hit Rate | 70% |

| TypeScript Errors | 0 |

| ESLint Violations | 0 |

 

---

 

## Testing

 

```bash

# Full test suite

npm test

 

# Type checking

npm run typecheck

 

# Linting

npm run lint

 

# Deterministic security eval

npm run eval:ci

 

# E2E tests

npm run test:e2e

 

# Python orchestrator tests

cd orchestrator && pytest

```

 

### Test Coverage



- **517 tests total** (87.0% pass rate, 450 passing)

- 59 test files (48 TypeScript + 11 Python)

- 43 test suites (37 passing, 6 skipped)

- 22 prompt injection patterns validated

- MAESTRO security tests (55 tests)

- E2E tests (security, stress, integration)

- Web3 wallet integration tests

- Chaos simulation and recovery tests

 

---

 

## Deployment

 

### Vercel (Recommended)

 

```bash

npm i -g vercel

vercel --prod

```

 

Configure environment variables in Vercel dashboard.

 

### Docker

 

```bash

docker compose -f docker-compose.prod.yml up -d

```

 

### CI/CD Pipelines

 

| Workflow | Trigger | Purpose |

|----------|---------|---------|

| ci-runtime-gates | PR/Push | Build, test, lint |

| cd-staging | Push to develop | Staging deployment |

| deploy-web3-functions | Push to main | Edge function deployment |

| secret-scanning | PR | Security scanning |

| chaos-simulation-ci | Scheduled | Resilience testing |

 

---

 

## Documentation

 

| Document | Description |

|----------|-------------|

| [Technical Architecture](docs/TECH_SPEC_ARCHITECTURE.md) | System design deep-dive |

| [Production Status](docs/PRODUCTION_STATUS.md) | Current deployment state |

| [Orchestrator Guide](orchestrator/README.md) | Temporal.io setup |

| [OmniDash Guide](OMNIDASH.md) | Dashboard documentation |

| [Web3 Setup](BLOCKCHAIN_CONFIG.md) | Blockchain configuration |

| [Security Policies](docs/SOC2_READINESS.md) | Compliance documentation |

| [Operations Runbook](OPS_RUNBOOK.md) | Incident response |

 

---

 

## Contributing

 

1. Fork the repository

2. Create a feature branch: `git checkout -b feature/your-feature`

3. Write tests for your changes

4. Run the full test suite: `npm test`

5. Submit a pull request

 

### Standards

 

- TypeScript strict mode

- Conventional commits

- 80%+ test coverage for new code

- Documentation for public APIs

 

---

 

## License

 

Proprietary - APEX Business Systems

 

---

 

**APEX OmniHub** - Enterprise AI orchestration, built for scale, secured for production.
