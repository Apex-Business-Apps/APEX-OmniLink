#!/bin/bash
#
# Mock Webhook Payload Generator
#
# Purpose: Generate realistic Alchemy webhook payloads for testing
#
# Usage:
#   ./scripts/generate-webhook-payload.sh [--sign] [--transfer-type mint|transfer|burn]
#
# Author: OmniLink APEX
# Date: 2026-01-01

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load environment
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs 2>/dev/null)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs 2>/dev/null)
fi

NFT_CONTRACT="${MEMBERSHIP_NFT_ADDRESS:-0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb}"
SIGN_PAYLOAD=false
TRANSFER_TYPE="mint"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --sign)
      SIGN_PAYLOAD=true
      shift
      ;;
    --transfer-type)
      TRANSFER_TYPE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Generate addresses based on transfer type
case $TRANSFER_TYPE in
  "mint")
    FROM_ADDRESS="0x0000000000000000000000000000000000000000"
    TO_ADDRESS="0x$(openssl rand -hex 20)"
    ;;
  "burn")
    FROM_ADDRESS="0x$(openssl rand -hex 20)"
    TO_ADDRESS="0x0000000000000000000000000000000000000000"
    ;;
  "transfer")
    FROM_ADDRESS="0x$(openssl rand -hex 20)"
    TO_ADDRESS="0x$(openssl rand -hex 20)"
    ;;
  *)
    echo "Invalid transfer type: $TRANSFER_TYPE"
    exit 1
    ;;
esac

# Generate unique IDs
WEBHOOK_ID="wh_$(openssl rand -hex 8)"
EVENT_ID="whevt_$(openssl rand -hex 12)"
TX_HASH="0x$(openssl rand -hex 32)"
BLOCK_NUMBER="0x$(printf '%x' $((30000000 + RANDOM)))"
TOKEN_ID="$RANDOM"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

# Create payload
PAYLOAD=$(cat <<EOF
{
  "webhookId": "${WEBHOOK_ID}",
  "id": "${EVENT_ID}",
  "createdAt": "${TIMESTAMP}",
  "type": "NFT_ACTIVITY",
  "event": {
    "network": "MATIC_MAINNET",
    "activity": [
      {
        "fromAddress": "${FROM_ADDRESS}",
        "toAddress": "${TO_ADDRESS}",
        "contractAddress": "${NFT_CONTRACT}",
        "tokenId": "${TOKEN_ID}",
        "category": "erc721",
        "log": {
          "address": "${NFT_CONTRACT}",
          "topics": [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x000000000000000000000000${FROM_ADDRESS:2}",
            "0x000000000000000000000000${TO_ADDRESS:2}",
            "0x$(printf '%064x' $TOKEN_ID)"
          ],
          "data": "0x",
          "blockNumber": "${BLOCK_NUMBER}",
          "transactionHash": "${TX_HASH}",
          "transactionIndex": "0x$(printf '%x' $RANDOM)",
          "blockHash": "0x$(openssl rand -hex 32)",
          "logIndex": "0x$(printf '%x' $RANDOM)",
          "removed": false
        }
      }
    ]
  }
}
EOF
)

echo -e "${BLUE}=== Mock Alchemy Webhook Payload Generator ===${NC}\n"

echo -e "${CYAN}Transfer Type:${NC} ${TRANSFER_TYPE}"
echo -e "${CYAN}Contract:${NC}      ${NFT_CONTRACT}"
echo -e "${CYAN}From:${NC}          ${FROM_ADDRESS}"
echo -e "${CYAN}To:${NC}            ${TO_ADDRESS}"
echo -e "${CYAN}Token ID:${NC}      ${TOKEN_ID}"
echo -e "${CYAN}Block:${NC}         ${BLOCK_NUMBER}\n"

# Save to file
OUTPUT_FILE="/tmp/alchemy-webhook-${TRANSFER_TYPE}-${WEBHOOK_ID}.json"
echo "$PAYLOAD" > "$OUTPUT_FILE"

echo -e "${GREEN}✓ Payload saved to:${NC} ${OUTPUT_FILE}\n"

# Sign if requested
if [ "$SIGN_PAYLOAD" = true ]; then
  if [ -z "$ALCHEMY_WEBHOOK_SIGNING_KEY" ]; then
    echo -e "${YELLOW}⚠ ALCHEMY_WEBHOOK_SIGNING_KEY not set${NC}"
    echo -e "${YELLOW}  Set it to sign the payload${NC}\n"
  else
    SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$ALCHEMY_WEBHOOK_SIGNING_KEY" | cut -d' ' -f2)
    echo -e "${GREEN}✓ Signature generated${NC}"
    echo -e "${CYAN}X-Alchemy-Signature:${NC} ${SIGNATURE}\n"

    # Save signature to file
    echo "$SIGNATURE" > "${OUTPUT_FILE}.sig"
    echo -e "${GREEN}✓ Signature saved to:${NC} ${OUTPUT_FILE}.sig\n"
  fi
fi

# Display payload
echo -e "${CYAN}=== Payload ===${NC}"
echo "$PAYLOAD" | jq '.'

echo ""

# Show curl command
echo -e "${CYAN}=== Test Command ===${NC}\n"

SUPABASE_URL="${VITE_SUPABASE_URL:-https://your-project.supabase.co}"

if [ "$SIGN_PAYLOAD" = true ] && [ -n "$ALCHEMY_WEBHOOK_SIGNING_KEY" ]; then
  echo -e "curl -X POST \\"
  echo -e "  -H \"Content-Type: application/json\" \\"
  echo -e "  -H \"X-Alchemy-Signature: ${SIGNATURE}\" \\"
  echo -e "  -d @${OUTPUT_FILE} \\"
  echo -e "  ${SUPABASE_URL}/functions/v1/alchemy-webhook"
else
  echo -e "curl -X POST \\"
  echo -e "  -H \"Content-Type: application/json\" \\"
  echo -e "  -d @${OUTPUT_FILE} \\"
  echo -e "  ${SUPABASE_URL}/functions/v1/alchemy-webhook"
  echo -e "\n${YELLOW}Note: This will fail signature verification (401)${NC}"
fi

echo ""

# Generate multiple payloads option
echo -e "${CYAN}=== Generate More Payloads ===${NC}\n"
echo -e "Mint:     ${CYAN}./scripts/generate-webhook-payload.sh --transfer-type mint${NC}"
echo -e "Transfer: ${CYAN}./scripts/generate-webhook-payload.sh --transfer-type transfer${NC}"
echo -e "Burn:     ${CYAN}./scripts/generate-webhook-payload.sh --transfer-type burn${NC}"
echo -e "Signed:   ${CYAN}./scripts/generate-webhook-payload.sh --sign${NC}\n"
