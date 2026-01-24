#!/bin/bash

# Blockchain Environment Validation Script
# This script checks that all required blockchain environment variables are set
# Run this before deploying edge functions to production

set -e

echo "🔍 Validating Blockchain Environment Configuration..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

DEMO_MODE_ACTIVE=false
if [ "${DEMO_MODE}" = "true" ] || [ "${VITE_DEMO_MODE}" = "true" ]; then
    DEMO_MODE_ACTIVE=true
    echo -e "${YELLOW}⚠${NC} Demo mode enabled: relaxing blockchain env requirements"
    echo ""
fi

# Function to check if variable is set
check_var() {
    local var_name=$1
    local required=$2
    local var_value="${!var_name}"

    if [ -z "$var_value" ]; then
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗${NC} $var_name is NOT SET (required)"
            ((ERRORS++))
        else
            echo -e "${YELLOW}⚠${NC} $var_name is NOT SET (optional)"
            ((WARNINGS++))
        fi
    else
        echo -e "${GREEN}✓${NC} $var_name is set"
    fi
    return 0
}

# Function to validate Ethereum address format
validate_address() {
    local var_name=$1
    local var_value="${!var_name}"

    if [ -n "$var_value" ]; then
        if [[ $var_value =~ ^0x[a-fA-F0-9]{40}$ ]]; then
            echo -e "  ${GREEN}✓${NC} Valid Ethereum address format"
        else
            echo -e "  ${RED}✗${NC} Invalid Ethereum address format (should be 0x followed by 40 hex chars)"
            ((ERRORS++))
        fi
    fi
    return 0
}

# Function to validate private key format
validate_private_key() {
    local var_name=$1
    local var_value="${!var_name}"

    if [ -n "$var_value" ]; then
        # Check if it's 64 hex chars (with or without 0x prefix)
        if [[ $var_value =~ ^(0x)?[a-fA-F0-9]{64}$ ]]; then
            echo -e "  ${GREEN}✓${NC} Valid private key format"
        else
            echo -e "  ${RED}✗${NC} Invalid private key format (should be 64 hex chars, optionally prefixed with 0x)"
            ((ERRORS++))
        fi

        # Security check: ensure it's not a well-known test key
        if [[ $var_value == *"deadbeef"* ]] || [[ $var_value == *"11111111"* ]]; then
            echo -e "  ${YELLOW}⚠${NC} WARNING: Private key looks like a test/example key"
            ((WARNINGS++))
        fi
    fi
    return 0
}

echo "Required Variables:"
echo "===================="
if [ "$DEMO_MODE_ACTIVE" = "true" ]; then
    check_var "WEB3_PRIVATE_KEY" "false"
else
    check_var "WEB3_PRIVATE_KEY" "true"
    validate_private_key "WEB3_PRIVATE_KEY"
fi

if [ "$DEMO_MODE_ACTIVE" = "true" ]; then
    check_var "MEMBERSHIP_NFT_ADDRESS" "false"
else
    check_var "MEMBERSHIP_NFT_ADDRESS" "true"
    validate_address "MEMBERSHIP_NFT_ADDRESS"
fi

echo ""
echo "RPC Configuration:"
echo "=================="
check_var "ALCHEMY_API_KEY_ETH" "false"
check_var "ALCHEMY_API_KEY_POLYGON" "false"

# At least one RPC key should be set
if [ -z "$ALCHEMY_API_KEY_ETH" ] && [ -z "$ALCHEMY_API_KEY_POLYGON" ]; then
    if [ "$DEMO_MODE_ACTIVE" = "true" ]; then
        echo -e "${YELLOW}⚠${NC} Demo mode: RPC API keys are optional"
        ((WARNINGS++))
    else
        echo -e "${RED}✗${NC} ERROR: At least one RPC API key (ETH or Polygon) must be set" >&2
        ((ERRORS++))
    fi
fi

echo ""
echo "Webhook Configuration:"
echo "======================"
check_var "ALCHEMY_WEBHOOK_SIGNING_KEY" "false"

if [ -z "$ALCHEMY_WEBHOOK_SIGNING_KEY" ]; then
    if [ "$DEMO_MODE_ACTIVE" = "true" ]; then
        echo -e "  ${YELLOW}⚠${NC} Demo mode: webhook signature verification is optional"
        ((WARNINGS++))
    else
        echo -e "  ${YELLOW}⚠${NC} Webhook signature verification will be disabled"
        echo -e "  ${YELLOW}⚠${NC} This is acceptable for local testing but REQUIRED for production"
    fi
fi

echo ""
echo "Optional Configuration:"
echo "======================="
check_var "VITE_WEB3_NETWORK" "false"
check_var "VITE_ENABLE_WEB3" "false"

echo ""
echo "Supabase Configuration:"
echo "======================="
check_var "VITE_SUPABASE_URL" "true"
SUPABASE_KEY_SET=false
if [ -n "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
    echo -e "${GREEN}✓${NC} VITE_SUPABASE_PUBLISHABLE_KEY is set"
    SUPABASE_KEY_SET=true
elif [ -n "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${GREEN}✓${NC} VITE_SUPABASE_ANON_KEY is set"
    SUPABASE_KEY_SET=true
else
    echo -e "${RED}✗${NC} Neither VITE_SUPABASE_PUBLISHABLE_KEY nor VITE_SUPABASE_ANON_KEY is set"
    ((ERRORS++))
fi

echo ""
echo "Summary:"
echo "========"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC} Environment is ready for deployment."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found.${NC} Review warnings before deploying to production."
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) found.${NC} Fix errors before deploying." >&2
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS warning(s) also found.${NC}" >&2
    fi
    exit 1
fi
