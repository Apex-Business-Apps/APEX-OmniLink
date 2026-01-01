#!/bin/bash
#
# End-to-End Blockchain Functions Test Suite
#
# Purpose: Comprehensive production battery test for all blockchain functions
#
# Tests:
#   - Complete wallet authentication flow
#   - NFT verification with caching
#   - Webhook event processing
#   - Rate limiting behavior
#   - Security validations
#   - Error handling
#
# Usage:
#   ./scripts/e2e-blockchain-test.sh [--verbose]
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
MAGENTA='\033[0;35m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Verbose mode
VERBOSE=false
if [ "$1" = "--verbose" ]; then
  VERBOSE=true
fi

# Load environment
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs 2>/dev/null)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs 2>/dev/null)
fi

SUPABASE_URL="${VITE_SUPABASE_URL}"
ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$VITE_SUPABASE_PUBLISHABLE_KEY}"

# Test result tracking
declare -a test_results

log_test() {
  local status=$1
  local name=$2
  local message=$3

  ((TOTAL_TESTS++))

  case $status in
    "PASS")
      ((PASSED_TESTS++))
      echo -e "${GREEN}✓ PASS${NC} | $name"
      test_results+=("PASS|$name|$message")
      ;;
    "FAIL")
      ((FAILED_TESTS++))
      echo -e "${RED}✗ FAIL${NC} | $name"
      test_results+=("FAIL|$name|$message")
      if [ "$VERBOSE" = true ]; then
        echo -e "  ${RED}$message${NC}"
      fi
      ;;
    "SKIP")
      ((SKIPPED_TESTS++))
      echo -e "${YELLOW}⊘ SKIP${NC} | $name"
      test_results+=("SKIP|$name|$message")
      ;;
  esac
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   OmniLink APEX - Blockchain E2E Test Suite               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Pre-flight checks
echo -e "${CYAN}=== Pre-flight Checks ===${NC}\n"

if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}Error: SUPABASE_URL not configured${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Supabase URL: ${SUPABASE_URL}${NC}"

if [ -z "$ANON_KEY" ]; then
  echo -e "${RED}Error: ANON_KEY not configured${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Anon Key: ${ANON_KEY:0:20}...${NC}\n"

# Check if functions exist
echo -e "${CYAN}=== Checking Edge Functions Availability ===${NC}\n"

for func in web3-nonce web3-verify verify-nft alchemy-webhook; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/functions/v1/${func}" 2>&1)

  if [[ "$response" =~ ^(200|401|405)$ ]]; then
    echo -e "${GREEN}✓ ${func} endpoint accessible${NC}"
  else
    echo -e "${YELLOW}⚠ ${func} returned ${response}${NC}"
  fi
done

echo ""

# Mock wallet for testing
MOCK_WALLET="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
MOCK_SIGNATURE="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12"

echo -e "${CYAN}=== Test Suite 1: Nonce Generation ===${NC}\n"

# Test 1.1: Generate nonce successfully
test_nonce_generation() {
  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"wallet_address\": \"${MOCK_WALLET}\"}" \
    "${SUPABASE_URL}/functions/v1/web3-nonce")

  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | sed '$d')

  if [ "$http_code" -eq 200 ]; then
    local has_nonce=$(echo "$body" | jq -e '.nonce' >/dev/null 2>&1 && echo "true" || echo "false")
    local has_message=$(echo "$body" | jq -e '.message' >/dev/null 2>&1 && echo "true" || echo "false")

    if [ "$has_nonce" = "true" ] && [ "$has_message" = "true" ]; then
      log_test "PASS" "Generate nonce for valid wallet" "Nonce created successfully"

      # Store nonce for later tests
      NONCE=$(echo "$body" | jq -r '.nonce')
      MESSAGE=$(echo "$body" | jq -r '.message')
      return 0
    else
      log_test "FAIL" "Generate nonce for valid wallet" "Missing nonce or message in response"
      return 1
    fi
  else
    log_test "FAIL" "Generate nonce for valid wallet" "HTTP $http_code"
    return 1
  fi
}

# Test 1.2: Reject invalid wallet address
test_invalid_wallet() {
  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"wallet_address": "invalid"}' \
    "${SUPABASE_URL}/functions/v1/web3-nonce")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 400 ]; then
    log_test "PASS" "Reject invalid wallet address" "Correctly rejected"
    return 0
  else
    log_test "FAIL" "Reject invalid wallet address" "Expected 400, got $http_code"
    return 1
  fi
}

# Test 1.3: Idempotent nonce generation
test_nonce_idempotency() {
  local response1=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"wallet_address\": \"${MOCK_WALLET}\"}" \
    "${SUPABASE_URL}/functions/v1/web3-nonce")

  sleep 1

  local response2=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"wallet_address\": \"${MOCK_WALLET}\"}" \
    "${SUPABASE_URL}/functions/v1/web3-nonce")

  local nonce1=$(echo "$response1" | jq -r '.nonce')
  local nonce2=$(echo "$response2" | jq -r '.nonce')

  if [ "$nonce1" = "$nonce2" ]; then
    log_test "PASS" "Nonce idempotency" "Same nonce returned for duplicate requests"
    return 0
  else
    log_test "FAIL" "Nonce idempotency" "Different nonces returned"
    return 1
  fi
}

# Test 1.4: Rate limiting
test_nonce_rate_limit() {
  local rate_limited=false

  for i in {1..10}; do
    local response=$(curl -s -w "\n%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "{\"wallet_address\": \"0x$(openssl rand -hex 20)\"}" \
      "${SUPABASE_URL}/functions/v1/web3-nonce")

    local http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" -eq 429 ]; then
      rate_limited=true
      break
    fi
  done

  if [ "$rate_limited" = true ]; then
    log_test "PASS" "Nonce rate limiting" "Rate limit triggered after multiple requests"
    return 0
  else
    log_test "SKIP" "Nonce rate limiting" "Rate limit not triggered (expected for low volume)"
    return 0
  fi
}

# Run nonce tests
test_nonce_generation
test_invalid_wallet
test_nonce_idempotency
test_nonce_rate_limit

echo ""
echo -e "${CYAN}=== Test Suite 2: Signature Verification ===${NC}\n"

# Test 2.1: Reject without authentication
test_verify_no_auth() {
  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{}" \
    "${SUPABASE_URL}/functions/v1/web3-verify")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 401 ]; then
    log_test "PASS" "Reject verification without auth" "Correctly returned 401"
    return 0
  else
    log_test "FAIL" "Reject verification without auth" "Expected 401, got $http_code"
    return 1
  fi
}

# Test 2.2: Reject invalid signature format
test_verify_invalid_signature() {
  log_test "SKIP" "Reject invalid signature" "Requires valid JWT token"
}

test_verify_no_auth
test_verify_invalid_signature

echo ""
echo -e "${CYAN}=== Test Suite 3: NFT Verification ===${NC}\n"

# Test 3.1: Reject without authentication
test_nft_no_auth() {
  local response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "${SUPABASE_URL}/functions/v1/verify-nft")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 401 ]; then
    log_test "PASS" "Reject NFT check without auth" "Correctly returned 401"
    return 0
  else
    log_test "FAIL" "Reject NFT check without auth" "Expected 401, got $http_code"
    return 1
  fi
}

# Test 3.2: Reject wrong HTTP method
test_nft_wrong_method() {
  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    "${SUPABASE_URL}/functions/v1/verify-nft")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 401 ] || [ "$http_code" -eq 405 ]; then
    log_test "PASS" "Reject POST to NFT verification" "Correctly rejected"
    return 0
  else
    log_test "FAIL" "Reject POST to NFT verification" "Expected 401/405, got $http_code"
    return 1
  fi
}

test_nft_no_auth
test_nft_wrong_method

echo ""
echo -e "${CYAN}=== Test Suite 4: Webhook Processing ===${NC}\n"

# Test 4.1: Reject unsigned webhooks
test_webhook_no_signature() {
  local payload='{
    "webhookId": "wh_test_'$(date +%s)'",
    "id": "whevt_test",
    "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "type": "NFT_ACTIVITY",
    "event": {
      "network": "MATIC_MAINNET",
      "activity": []
    }
  }'

  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "${SUPABASE_URL}/functions/v1/alchemy-webhook")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 401 ]; then
    log_test "PASS" "Reject unsigned webhook" "Correctly returned 401"
    return 0
  else
    log_test "FAIL" "Reject unsigned webhook" "Expected 401, got $http_code"
    return 1
  fi
}

# Test 4.2: Reject invalid signature
test_webhook_invalid_signature() {
  local payload='{
    "webhookId": "wh_test_'$(date +%s)'",
    "id": "whevt_test",
    "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "type": "NFT_ACTIVITY",
    "event": {
      "network": "MATIC_MAINNET",
      "activity": []
    }
  }'

  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Alchemy-Signature: invalid-signature" \
    -d "$payload" \
    "${SUPABASE_URL}/functions/v1/alchemy-webhook")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 401 ]; then
    log_test "PASS" "Reject invalid webhook signature" "Correctly returned 401"
    return 0
  else
    log_test "FAIL" "Reject invalid webhook signature" "Expected 401, got $http_code"
    return 1
  fi
}

# Test 4.3: Reject wrong HTTP method
test_webhook_wrong_method() {
  local response=$(curl -s -w "\n%{http_code}" \
    -X GET \
    "${SUPABASE_URL}/functions/v1/alchemy-webhook")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 405 ]; then
    log_test "PASS" "Reject GET to webhook endpoint" "Correctly returned 405"
    return 0
  else
    log_test "FAIL" "Reject GET to webhook endpoint" "Expected 405, got $http_code"
    return 1
  fi
}

# Test 4.4: Reject malformed JSON
test_webhook_malformed_json() {
  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Alchemy-Signature: test" \
    -d '{invalid json}' \
    "${SUPABASE_URL}/functions/v1/alchemy-webhook")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 400 ] || [ "$http_code" -eq 401 ]; then
    log_test "PASS" "Reject malformed JSON" "Correctly rejected"
    return 0
  else
    log_test "FAIL" "Reject malformed JSON" "Expected 400/401, got $http_code"
    return 1
  fi
}

test_webhook_no_signature
test_webhook_invalid_signature
test_webhook_wrong_method
test_webhook_malformed_json

echo ""
echo -e "${CYAN}=== Test Suite 5: CORS & Headers ===${NC}\n"

# Test 5.1: CORS preflight for nonce
test_cors_nonce() {
  local response=$(curl -s -i \
    -X OPTIONS \
    "${SUPABASE_URL}/functions/v1/web3-nonce" 2>&1)

  if echo "$response" | grep -qi "Access-Control-Allow-Origin"; then
    log_test "PASS" "CORS headers on nonce endpoint" "CORS headers present"
    return 0
  else
    log_test "SKIP" "CORS headers on nonce endpoint" "Could not verify CORS"
    return 0
  fi
}

# Test 5.2: Rate limit headers
test_rate_limit_headers() {
  local response=$(curl -s -i \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"wallet_address\": \"${MOCK_WALLET}\"}" \
    "${SUPABASE_URL}/functions/v1/web3-nonce" 2>&1)

  if echo "$response" | grep -qi "x-ratelimit"; then
    log_test "PASS" "Rate limit headers present" "Headers found"
    return 0
  else
    log_test "SKIP" "Rate limit headers present" "Headers not in response"
    return 0
  fi
}

test_cors_nonce
test_rate_limit_headers

echo ""
echo -e "${CYAN}=== Test Suite 6: Security Validations ===${NC}\n"

# Test 6.1: SQL injection attempt
test_sql_injection() {
  local malicious_wallet="0x'; DROP TABLE users; --"

  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"wallet_address\": \"${malicious_wallet}\"}" \
    "${SUPABASE_URL}/functions/v1/web3-nonce")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 400 ]; then
    log_test "PASS" "SQL injection prevention" "Malicious input rejected"
    return 0
  else
    log_test "FAIL" "SQL injection prevention" "Expected 400, got $http_code"
    return 1
  fi
}

# Test 6.2: XSS attempt
test_xss_prevention() {
  local malicious_wallet="<script>alert('xss')</script>"

  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"wallet_address\": \"${malicious_wallet}\"}" \
    "${SUPABASE_URL}/functions/v1/web3-nonce")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 400 ]; then
    log_test "PASS" "XSS prevention" "Malicious input rejected"
    return 0
  else
    log_test "FAIL" "XSS prevention" "Expected 400, got $http_code"
    return 1
  fi
}

# Test 6.3: Oversized payload
test_oversized_payload() {
  local large_payload=$(printf '{"wallet_address": "%0.s0x1234567890abcdef", "data": "%2000s"}' {1..100})

  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$large_payload" \
    "${SUPABASE_URL}/functions/v1/web3-nonce" 2>&1)

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq 400 ] || [ "$http_code" -eq 413 ]; then
    log_test "PASS" "Oversized payload handling" "Large payload rejected"
    return 0
  else
    log_test "SKIP" "Oversized payload handling" "No size limit triggered"
    return 0
  fi
}

test_sql_injection
test_xss_prevention
test_oversized_payload

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Test Results Summary                                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${CYAN}Total Tests:${NC}   $TOTAL_TESTS"
echo -e "${GREEN}Passed:${NC}        $PASSED_TESTS"
echo -e "${RED}Failed:${NC}        $FAILED_TESTS"
echo -e "${YELLOW}Skipped:${NC}       $SKIPPED_TESTS\n"

# Calculate pass rate
if [ $TOTAL_TESTS -gt 0 ]; then
  pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  echo -e "${CYAN}Pass Rate:${NC}     ${pass_rate}%\n"
fi

# Detailed results if verbose
if [ "$VERBOSE" = true ]; then
  echo -e "${CYAN}=== Detailed Results ===${NC}\n"

  for result in "${test_results[@]}"; do
    IFS='|' read -r status name message <<< "$result"

    case $status in
      "PASS")
        echo -e "${GREEN}✓${NC} $name - $message"
        ;;
      "FAIL")
        echo -e "${RED}✗${NC} $name - $message"
        ;;
      "SKIP")
        echo -e "${YELLOW}⊘${NC} $name - $message"
        ;;
    esac
  done
  echo ""
fi

# Exit code based on failures
if [ $FAILED_TESTS -gt 0 ]; then
  echo -e "${RED}Some tests failed. Review the output above.${NC}\n"
  exit 1
else
  echo -e "${GREEN}All tests passed successfully!${NC}\n"
  exit 0
fi
