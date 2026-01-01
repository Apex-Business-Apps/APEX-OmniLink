#!/bin/bash
#
# Alchemy Webhook Setup Automation
#
# Purpose: Automate Alchemy webhook configuration for NFT events
#
# Usage:
#   ./scripts/setup-alchemy-webhook.sh
#
# Prerequisites:
#   - Alchemy API key (from dashboard)
#   - Supabase URL configured
#   - MEMBERSHIP_NFT_ADDRESS set
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

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Alchemy Webhook Setup - OmniLink APEX                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Load environment
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check prerequisites
echo -e "${CYAN}1. Checking Prerequisites...${NC}"

if [ -z "$VITE_SUPABASE_URL" ]; then
  echo -e "${RED}✗ VITE_SUPABASE_URL not set${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Supabase URL: ${VITE_SUPABASE_URL}${NC}"

if [ -z "$MEMBERSHIP_NFT_ADDRESS" ]; then
  echo -e "${YELLOW}⚠ MEMBERSHIP_NFT_ADDRESS not set${NC}"
  echo -e "${YELLOW}  You'll need to set this after deploying your NFT contract${NC}"
else
  echo -e "${GREEN}✓ NFT Contract: ${MEMBERSHIP_NFT_ADDRESS}${NC}"
fi

# Webhook URL
WEBHOOK_URL="${VITE_SUPABASE_URL}/functions/v1/alchemy-webhook"
echo -e "${GREEN}✓ Webhook URL: ${WEBHOOK_URL}${NC}\n"

# Alchemy API Key
echo -e "${CYAN}2. Alchemy API Configuration${NC}"
echo -e "${YELLOW}Enter your Alchemy API Key (or press Enter to skip):${NC}"
read -r ALCHEMY_KEY

if [ -z "$ALCHEMY_KEY" ]; then
  echo -e "${YELLOW}Skipping Alchemy API setup${NC}\n"
  SKIP_API=true
else
  echo -e "${GREEN}✓ API Key configured${NC}\n"
  SKIP_API=false
fi

# Instructions for manual setup
echo -e "${CYAN}3. Webhook Configuration Steps${NC}\n"

echo -e "${BLUE}Follow these steps to configure your Alchemy webhook:${NC}\n"

echo -e "${YELLOW}Step 1: Login to Alchemy Dashboard${NC}"
echo -e "  → Visit: ${CYAN}https://dashboard.alchemy.com/${NC}"
echo -e "  → Select your Polygon app\n"

echo -e "${YELLOW}Step 2: Navigate to Webhooks${NC}"
echo -e "  → Click 'Webhooks' in left sidebar"
echo -e "  → Click '+ Create Webhook'\n"

echo -e "${YELLOW}Step 3: Configure Webhook${NC}"
echo -e "  ${BLUE}Webhook Type:${NC} NFT Activity"
echo -e "  ${BLUE}Network:${NC} Polygon Mainnet (MATIC_MAINNET)"
echo -e "  ${BLUE}Webhook URL:${NC}"
echo -e "    ${GREEN}${WEBHOOK_URL}${NC}"
echo -e "  ${BLUE}Addresses to Watch:${NC}"
if [ -n "$MEMBERSHIP_NFT_ADDRESS" ]; then
  echo -e "    ${GREEN}${MEMBERSHIP_NFT_ADDRESS}${NC}"
else
  echo -e "    ${YELLOW}[Your APEXMembershipNFT contract address]${NC}"
fi
echo -e "  ${BLUE}Event Types:${NC} ✓ NFT Transfers\n"

echo -e "${YELLOW}Step 4: Copy Signing Key${NC}"
echo -e "  → After creating webhook, copy the 'Signing Key'"
echo -e "  → This will be used to verify webhook authenticity\n"

echo -e "${YELLOW}Step 5: Set Environment Variable${NC}"
echo -e "  ${BLUE}In Supabase Dashboard:${NC}"
echo -e "    → Settings → Edge Functions → Secrets"
echo -e "    → Add: ${GREEN}ALCHEMY_WEBHOOK_SIGNING_KEY${NC}"
echo -e "    → Value: [Your signing key from Step 4]\n"
echo -e "  ${BLUE}Or via CLI:${NC}"
echo -e "    ${CYAN}supabase secrets set ALCHEMY_WEBHOOK_SIGNING_KEY=your-key${NC}\n"

# Create webhook payload template
echo -e "${CYAN}4. Generating Test Payload...${NC}"

cat > /tmp/alchemy-webhook-test.json <<EOF
{
  "webhookId": "wh_test_$(date +%s)",
  "id": "whevt_test_$(date +%s)",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "type": "NFT_ACTIVITY",
  "event": {
    "network": "MATIC_MAINNET",
    "activity": [
      {
        "fromAddress": "0x0000000000000000000000000000000000000000",
        "toAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "contractAddress": "${MEMBERSHIP_NFT_ADDRESS:-0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb}",
        "tokenId": "1",
        "category": "erc721",
        "log": {
          "blockNumber": "0x$(printf '%x' $RANDOM)",
          "transactionHash": "0x$(openssl rand -hex 32)"
        }
      }
    ]
  }
}
EOF

echo -e "${GREEN}✓ Test payload saved to: ${CYAN}/tmp/alchemy-webhook-test.json${NC}\n"

# Generate HMAC signature helper
echo -e "${CYAN}5. Creating Signature Helper Script...${NC}"

cat > /tmp/sign-webhook.sh <<'SIGN_EOF'
#!/bin/bash
# Generate HMAC-SHA256 signature for Alchemy webhook testing

if [ -z "$1" ]; then
  echo "Usage: $0 <signing_key> [payload_file]"
  exit 1
fi

SIGNING_KEY="$1"
PAYLOAD_FILE="${2:-/tmp/alchemy-webhook-test.json}"

if [ ! -f "$PAYLOAD_FILE" ]; then
  echo "Error: Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

SIGNATURE=$(cat "$PAYLOAD_FILE" | openssl dgst -sha256 -hmac "$SIGNING_KEY" | cut -d' ' -f2)

echo "X-Alchemy-Signature: $SIGNATURE"
SIGN_EOF

chmod +x /tmp/sign-webhook.sh

echo -e "${GREEN}✓ Signature helper saved to: ${CYAN}/tmp/sign-webhook.sh${NC}\n"

# Test webhook endpoint
echo -e "${CYAN}6. Testing Webhook Endpoint (without signature)...${NC}"

response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d @/tmp/alchemy-webhook-test.json \
  "${WEBHOOK_URL}" 2>&1)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 401 ]; then
  echo -e "${GREEN}✓ Webhook correctly rejects unsigned requests (401)${NC}"
  echo -e "${BLUE}  Response: ${body}${NC}\n"
else
  echo -e "${YELLOW}⚠ Unexpected response code: ${http_code}${NC}"
  echo -e "${BLUE}  Response: ${body}${NC}\n"
fi

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Setup Summary                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}✓ Webhook URL configured:${NC}"
echo -e "  ${CYAN}${WEBHOOK_URL}${NC}\n"

echo -e "${GREEN}✓ Test payload generated:${NC}"
echo -e "  ${CYAN}/tmp/alchemy-webhook-test.json${NC}\n"

echo -e "${GREEN}✓ Signature helper created:${NC}"
echo -e "  ${CYAN}/tmp/sign-webhook.sh <signing_key>${NC}\n"

echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Complete Alchemy webhook setup in dashboard"
echo -e "  2. Copy signing key from Alchemy"
echo -e "  3. Set ${GREEN}ALCHEMY_WEBHOOK_SIGNING_KEY${NC} in Supabase"
echo -e "  4. Test with: ${CYAN}./scripts/test-blockchain-functions.sh${NC}\n"

echo -e "${BLUE}For testing with signature:${NC}"
echo -e "  ${CYAN}/tmp/sign-webhook.sh YOUR_SIGNING_KEY${NC}\n"

echo -e "${GREEN}Setup complete!${NC}\n"
