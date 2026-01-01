#!/bin/bash
#
# Test Blockchain Edge Functions
#
# Purpose: Test verify-nft and alchemy-webhook functions
#
# Usage:
#   ./scripts/test-blockchain-functions.sh
#
# Prerequisites:
#   - SUPABASE_URL and SUPABASE_ANON_KEY in .env.local
#   - Valid user JWT token (login first)
#
# Author: OmniLink APEX
# Date: 2026-01-01

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo -e "${RED}Error: .env.local or .env file not found${NC}"
  exit 1
fi

# Check required environment variables
if [ -z "$VITE_SUPABASE_URL" ]; then
  echo -e "${RED}Error: VITE_SUPABASE_URL not set${NC}"
  exit 1
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ] && [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
  echo -e "${RED}Error: VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY not set${NC}"
  exit 1
fi

SUPABASE_URL="${VITE_SUPABASE_URL}"
ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$VITE_SUPABASE_PUBLISHABLE_KEY}"

echo -e "${BLUE}=== OmniLink APEX Blockchain Functions Test Suite ===${NC}\n"

# Function to get JWT token
get_jwt_token() {
  echo -e "${YELLOW}To test these functions, you need a valid JWT token.${NC}"
  echo -e "${YELLOW}Options:${NC}"
  echo -e "  1. Login via the web app and copy token from browser DevTools"
  echo -e "  2. Use supabase CLI: ${GREEN}supabase auth login${NC}"
  echo -e "  3. Create a test user and get token programmatically"
  echo ""
  echo -e "${YELLOW}Enter your JWT token (or press Enter to skip):${NC}"
  read -r JWT_TOKEN

  if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}No token provided. Skipping authenticated tests.${NC}\n"
    return 1
  fi

  echo "$JWT_TOKEN"
}

# Test 1: verify-nft function (cached)
test_verify_nft_cached() {
  local jwt=$1

  echo -e "${BLUE}Test 1: Verify NFT Ownership (cached)${NC}"
  echo -e "Endpoint: ${GREEN}GET /verify-nft${NC}"

  response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $jwt" \
    -H "Content-Type: application/json" \
    "${SUPABASE_URL}/functions/v1/verify-nft")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  echo -e "Status: ${http_code}"
  echo -e "Response:"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"

  if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Test passed${NC}\n"
    return 0
  else
    echo -e "${RED}✗ Test failed${NC}\n"
    return 1
  fi
}

# Test 2: verify-nft function (force refresh)
test_verify_nft_force_refresh() {
  local jwt=$1

  echo -e "${BLUE}Test 2: Verify NFT Ownership (force refresh from blockchain)${NC}"
  echo -e "Endpoint: ${GREEN}GET /verify-nft?force_refresh=true${NC}"

  response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $jwt" \
    -H "Content-Type: application/json" \
    "${SUPABASE_URL}/functions/v1/verify-nft?force_refresh=true")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  echo -e "Status: ${http_code}"
  echo -e "Response:"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"

  if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Test passed${NC}\n"
    return 0
  else
    echo -e "${RED}✗ Test failed${NC}\n"
    return 1
  fi
}

# Test 3: verify-nft without auth (should fail)
test_verify_nft_no_auth() {
  echo -e "${BLUE}Test 3: Verify NFT without authentication (should return 401)${NC}"
  echo -e "Endpoint: ${GREEN}GET /verify-nft${NC}"

  response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "${SUPABASE_URL}/functions/v1/verify-nft")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  echo -e "Status: ${http_code}"
  echo -e "Response:"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"

  if [ "$http_code" -eq 401 ]; then
    echo -e "${GREEN}✓ Test passed (correctly rejected)${NC}\n"
    return 0
  else
    echo -e "${RED}✗ Test failed (should have returned 401)${NC}\n"
    return 1
  fi
}

# Test 4: alchemy-webhook (mock request)
test_alchemy_webhook_no_signature() {
  echo -e "${BLUE}Test 4: Alchemy Webhook without signature (should return 401)${NC}"
  echo -e "Endpoint: ${GREEN}POST /alchemy-webhook${NC}"

  payload='{
    "webhookId": "wh_test_123",
    "id": "whevt_test_456",
    "createdAt": "2026-01-01T12:00:00.000Z",
    "type": "NFT_ACTIVITY",
    "event": {
      "network": "MATIC_MAINNET",
      "activity": []
    }
  }'

  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "${SUPABASE_URL}/functions/v1/alchemy-webhook")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  echo -e "Status: ${http_code}"
  echo -e "Response:"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"

  if [ "$http_code" -eq 401 ]; then
    echo -e "${GREEN}✓ Test passed (correctly rejected unsigned webhook)${NC}\n"
    return 0
  else
    echo -e "${RED}✗ Test failed (should have returned 401)${NC}\n"
    return 1
  fi
}

# Test 5: Rate limiting check
test_rate_limiting() {
  local jwt=$1

  echo -e "${BLUE}Test 5: Rate Limiting Check${NC}"
  echo -e "Making 3 rapid requests to check rate limit headers..."

  for i in 1 2 3; do
    echo -e "\n${YELLOW}Request $i:${NC}"

    response=$(curl -s -i \
      -H "Authorization: Bearer $jwt" \
      -H "Content-Type: application/json" \
      "${SUPABASE_URL}/functions/v1/verify-nft" 2>&1)

    # Extract rate limit headers
    remaining=$(echo "$response" | grep -i "x-ratelimit-remaining" | cut -d' ' -f2 | tr -d '\r')

    if [ -n "$remaining" ]; then
      echo -e "Rate Limit Remaining: ${GREEN}$remaining${NC}"
    else
      echo -e "${YELLOW}Rate limit headers not found in response${NC}"
    fi

    sleep 0.5
  done

  echo -e "\n${GREEN}✓ Rate limiting test complete${NC}\n"
  return 0
}

# Main execution
main() {
  echo -e "${YELLOW}Testing blockchain edge functions...${NC}\n"

  # Get JWT token
  JWT_TOKEN=$(get_jwt_token)

  passed=0
  failed=0

  # Run unauthenticated tests first
  test_verify_nft_no_auth && ((passed++)) || ((failed++))
  test_alchemy_webhook_no_signature && ((passed++)) || ((failed++))

  # Run authenticated tests if token provided
  if [ -n "$JWT_TOKEN" ]; then
    test_verify_nft_cached "$JWT_TOKEN" && ((passed++)) || ((failed++))
    test_verify_nft_force_refresh "$JWT_TOKEN" && ((passed++)) || ((failed++))
    test_rate_limiting "$JWT_TOKEN" && ((passed++)) || ((failed++))
  else
    echo -e "${YELLOW}Skipping authenticated tests (no JWT token)${NC}\n"
  fi

  # Summary
  echo -e "${BLUE}=== Test Summary ===${NC}"
  echo -e "${GREEN}Passed: $passed${NC}"
  echo -e "${RED}Failed: $failed${NC}"

  if [ $failed -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! ✓${NC}"
    return 0
  else
    echo -e "\n${RED}Some tests failed ✗${NC}"
    return 1
  fi
}

# Run main function
main
