# Worldwide Wildcard Tests (WWWCT)

## Overview
WWWCT is a modular end-to-end test framework that exercises Web2 ↔ Web3 ↔ LLM orchestration flows in both MOCK and SANDBOX modes. It ships with reusable scenario definitions, guardrails, and structured reporting outputs (JSON, JUnit, Markdown).

## Scenario DSL
Scenario definitions live in `tests/worldwide-wildcard/scenarios` and are authored in YAML.

Required fields:
- `name`, `version`, `locale`, `deviceProfile`, `environment`
- `integrations` (web2/web3/llm/japanMarket)
- `steps[]` (typed actions)
- `assertions[]`

Example step types:
- `send_command`
- `emit_event`
- `verify_audit`
- `mint_nft`
- `send_email`
- `create_doc`
- `wildcard_injection`
- `report_back`

## Runner Modes
- **MOCK (default)**: uses safe adapters without real provider keys.
- **SANDBOX**: requires env guardrails and uses OmniLink Universal Port endpoints.

### Guardrails
SANDBOX mode requires:
```bash
export SIM_MODE=true
export SANDBOX_TENANT=<uuid>
export OMNILINK_PORT_URL=<omnilink-edge-function-url>
```

## Reports
Outputs are written to `tests/worldwide-wildcard/reports`:
- `report.json`
- `junit.xml`
- `report.md`

## Run Commands
```bash
npm run test:wwwct
npm run test:wwwct:sandbox
npm run test:wwwct:report
```

## Playwright Device Profiles
Device profiles are mapped in `tests/worldwide-wildcard/playwright/projects.ts`:
- Desktop Chrome
- iOS Safari (WebKit)
- Android Chrome emulation

To run the Playwright confirmation suite:
```bash
npx playwright test -c tests/worldwide-wildcard/playwright/playwright.config.ts
```
