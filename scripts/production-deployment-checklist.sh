#!/bin/bash
#
# Production Deployment Checklist
#
# Purpose: Verify all blockchain functions are production-ready
#
# Usage:
#   ./scripts/production-deployment-checklist.sh
#
# Author: OmniLink APEX
# Date: 2026-01-01

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

check_item() {
  local status=$1
  local item=$2
  local details=$3

  case $status in
    "PASS")
      echo -e "${GREEN}✓${NC} $item"
      ((CHECKS_PASSED++))
      ;;
    "FAIL")
      echo -e "${RED}✗${NC} $item"
      if [ -n "$details" ]; then
        echo -e "  ${RED}$details${NC}"
      fi
      ((CHECKS_FAILED++))
      ;;
    "WARN")
      echo -e "${YELLOW}⚠${NC} $item"
      if [ -n "$details" ]; then
        echo -e "  ${YELLOW}$details${NC}"
      fi
      ((CHECKS_WARNING++))
      ;;
  esac
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Production Deployment Checklist                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Load environment
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs 2>/dev/null)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs 2>/dev/null)
fi

echo -e "${CYAN}=== 1. Environment Configuration ===${NC}\n"

# Check Supabase URL
if [ -n "$VITE_SUPABASE_URL" ]; then
  check_item "PASS" "SUPABASE_URL configured"
else
  check_item "FAIL" "SUPABASE_URL not set" "Set VITE_SUPABASE_URL in .env"
fi

# Check Anon Key
if [ -n "$VITE_SUPABASE_ANON_KEY" ] || [ -n "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
  check_item "PASS" "Supabase Anon Key configured"
else
  check_item "FAIL" "Supabase Anon Key not set" "Set VITE_SUPABASE_ANON_KEY"
fi

# Check Alchemy API Key
if [ -n "$ALCHEMY_API_KEY_POLYGON" ]; then
  check_item "PASS" "Alchemy API Key (Polygon) configured"
else
  check_item "FAIL" "ALCHEMY_API_KEY_POLYGON not set" "Get from https://dashboard.alchemy.com"
fi

# Check NFT Contract Address
if [ -n "$MEMBERSHIP_NFT_ADDRESS" ]; then
  if [[ "$MEMBERSHIP_NFT_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    check_item "PASS" "NFT Contract Address valid: $MEMBERSHIP_NFT_ADDRESS"
  else
    check_item "FAIL" "Invalid NFT Contract Address" "Must be valid Ethereum address"
  fi
else
  check_item "WARN" "MEMBERSHIP_NFT_ADDRESS not set" "Set after deploying NFT contract"
fi

# Check Webhook Signing Key
if [ -n "$ALCHEMY_WEBHOOK_SIGNING_KEY" ]; then
  check_item "PASS" "Alchemy Webhook Signing Key configured"
else
  check_item "WARN" "ALCHEMY_WEBHOOK_SIGNING_KEY not set" "Get from Alchemy webhook settings"
fi

echo ""
echo -e "${CYAN}=== 2. Edge Functions Deployment ===${NC}\n"

# Check if function files exist
for func in web3-nonce web3-verify verify-nft alchemy-webhook; do
  if [ -f "supabase/functions/${func}/index.ts" ]; then
    check_item "PASS" "Function ${func} exists"
  else
    check_item "FAIL" "Function ${func} not found" "Create or restore function file"
  fi
done

echo ""
echo -e "${CYAN}=== 3. Database Schema ===${NC}\n"

# Check migration files
MIGRATIONS=(
  "20260101000000_create_web3_verification.sql"
  "20260101000001_add_nft_profile_columns.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "supabase/migrations/$migration" ]; then
    check_item "PASS" "Migration $migration exists"
  else
    check_item "FAIL" "Migration $migration not found" "Create migration file"
  fi
done

echo ""
echo -e "${CYAN}=== 4. Test Coverage ===${NC}\n"

# Check test files
TESTS=(
  "tests/web3/signature-verification.test.ts"
  "tests/web3/wallet-integration.test.ts"
  "tests/web3/nft-verification.test.ts"
  "tests/web3/alchemy-webhook.test.ts"
)

for test in "${TESTS[@]}"; do
  if [ -f "$test" ]; then
    check_item "PASS" "Test file $(basename $test) exists"
  else
    check_item "WARN" "Test file $(basename $test) not found" "Create test coverage"
  fi
done

echo ""
echo -e "${CYAN}=== 5. Documentation ===${NC}\n"

# Check documentation
if [ -f "docs/blockchain-functions.md" ]; then
  check_item "PASS" "Blockchain functions documentation exists"
else
  check_item "WARN" "Documentation not found" "Create docs/blockchain-functions.md"
fi

# Check README
if [ -f "README.md" ]; then
  if grep -q "blockchain\|web3\|NFT" README.md 2>/dev/null; then
    check_item "PASS" "README mentions blockchain features"
  else
    check_item "WARN" "README doesn't mention blockchain" "Update README.md"
  fi
else
  check_item "WARN" "README.md not found"
fi

echo ""
echo -e "${CYAN}=== 6. Security Configuration ===${NC}\n"

# Check for exposed secrets
if [ -f ".env.local" ]; then
  check_item "PASS" ".env.local exists (secrets file)"

  # Verify .env.local is in .gitignore
  if grep -q "\.env\.local" .gitignore 2>/dev/null; then
    check_item "PASS" ".env.local in .gitignore"
  else
    check_item "FAIL" ".env.local NOT in .gitignore" "Add to .gitignore immediately!"
  fi
else
  check_item "WARN" ".env.local not found" "Create from .env.example"
fi

# Check .env.example
if [ -f ".env.example" ]; then
  check_item "PASS" ".env.example exists"

  # Verify it doesn't contain real secrets
  if grep -qE "(sk_live_|whsec_|0x[a-f0-9]{64})" .env.example 2>/dev/null; then
    check_item "FAIL" ".env.example contains real secrets" "Remove secrets from example file!"
  else
    check_item "PASS" ".env.example doesn't contain secrets"
  fi
fi

echo ""
echo -e "${CYAN}=== 7. Type Safety ===${NC}\n"

# Run type checking
if command -v npm &> /dev/null; then
  echo -e "${YELLOW}Running type check...${NC}"

  if npm run typecheck 2>&1 | grep -q "error TS"; then
    check_item "FAIL" "TypeScript compilation" "Fix type errors"
  else
    check_item "PASS" "TypeScript compilation passes"
  fi
else
  check_item "WARN" "npm not available" "Cannot verify TypeScript"
fi

echo ""
echo -e "${CYAN}=== 8. Deployment Scripts ===${NC}\n"

# Check deployment scripts
SCRIPTS=(
  "scripts/test-blockchain-functions.sh"
  "scripts/e2e-blockchain-test.sh"
  "scripts/setup-alchemy-webhook.sh"
  "scripts/generate-webhook-payload.sh"
  "scripts/production-deployment-checklist.sh"
)

for script in "${SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    if [ -x "$script" ]; then
      check_item "PASS" "$(basename $script) is executable"
    else
      check_item "WARN" "$(basename $script) not executable" "Run: chmod +x $script"
    fi
  else
    check_item "WARN" "Script $(basename $script) not found"
  fi
done

echo ""
echo -e "${CYAN}=== 9. Production Secrets (Supabase) ===${NC}\n"

echo -e "${YELLOW}Verify these secrets are set in Supabase Dashboard:${NC}"
echo -e "  → Settings → Edge Functions → Secrets"
echo ""

REQUIRED_SECRETS=(
  "ALCHEMY_API_KEY_POLYGON"
  "MEMBERSHIP_NFT_ADDRESS"
  "ALCHEMY_WEBHOOK_SIGNING_KEY"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
  if [ -n "${!secret}" ]; then
    check_item "PASS" "$secret set locally"
    echo -e "    ${CYAN}Verify in production:${NC} supabase secrets list | grep $secret"
  else
    check_item "WARN" "$secret not set locally"
    echo -e "    ${CYAN}Set in production:${NC} supabase secrets set $secret=..."
  fi
done

echo ""
echo -e "${CYAN}=== 10. Deployment Commands ===${NC}\n"

echo -e "${YELLOW}Run these commands to deploy:${NC}\n"

echo -e "${BLUE}1. Push database migrations:${NC}"
echo -e "   ${CYAN}supabase db push${NC}\n"

echo -e "${BLUE}2. Deploy edge functions:${NC}"
echo -e "   ${CYAN}supabase functions deploy web3-nonce${NC}"
echo -e "   ${CYAN}supabase functions deploy web3-verify${NC}"
echo -e "   ${CYAN}supabase functions deploy verify-nft${NC}"
echo -e "   ${CYAN}supabase functions deploy alchemy-webhook${NC}\n"

echo -e "${BLUE}3. Set production secrets:${NC}"
echo -e "   ${CYAN}supabase secrets set ALCHEMY_API_KEY_POLYGON=\$YOUR_KEY${NC}"
echo -e "   ${CYAN}supabase secrets set MEMBERSHIP_NFT_ADDRESS=\$CONTRACT_ADDRESS${NC}"
echo -e "   ${CYAN}supabase secrets set ALCHEMY_WEBHOOK_SIGNING_KEY=\$SIGNING_KEY${NC}\n"

echo -e "${BLUE}4. Configure Alchemy webhook:${NC}"
echo -e "   ${CYAN}./scripts/setup-alchemy-webhook.sh${NC}\n"

echo -e "${BLUE}5. Run production tests:${NC}"
echo -e "   ${CYAN}./scripts/e2e-blockchain-test.sh${NC}\n"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Checklist Summary                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

echo -e "${CYAN}Total Checks:${NC}  $TOTAL_CHECKS"
echo -e "${GREEN}Passed:${NC}        $CHECKS_PASSED"
echo -e "${RED}Failed:${NC}        $CHECKS_FAILED"
echo -e "${YELLOW}Warnings:${NC}      $CHECKS_WARNING\n"

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical checks passed!${NC}"
  echo -e "${GREEN}  Ready for production deployment${NC}\n"
  exit 0
else
  echo -e "${RED}✗ Some checks failed${NC}"
  echo -e "${RED}  Fix issues before deploying to production${NC}\n"
  exit 1
fi
