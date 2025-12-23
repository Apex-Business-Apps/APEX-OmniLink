#!/bin/bash
# Deployment Verification Script
# Tests production deployment for critical issues

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== OmniLink APEX Deployment Verification ===${NC}\n"

# Check if URL is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./scripts/verify-deployment.sh <deployment-url>${NC}"
    echo -e "Example: ./scripts/verify-deployment.sh https://omnilink-apex.vercel.app"
    exit 1
fi

DEPLOYMENT_URL=$1
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3

    echo -ne "Testing $name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1)

    if [ "$response" == "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $response)"
        ((FAILED++))
    fi
}

# Function to check for text in response
test_content() {
    local name=$1
    local url=$2
    local search_text=$3

    echo -ne "Checking $name... "

    response=$(curl -s "$url" 2>&1)

    if echo "$response" | grep -q "$search_text"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Text not found: $search_text)"
        ((FAILED++))
    fi
}

# Test 1: Homepage loads
echo -e "\n${BLUE}[1/7] Homepage Accessibility${NC}"
test_endpoint "Homepage" "$DEPLOYMENT_URL" "200"

# Test 2: Assets load
echo -e "\n${BLUE}[2/7] Static Assets${NC}"
test_endpoint "Favicon" "$DEPLOYMENT_URL/favicon.png" "200"
test_endpoint "Manifest" "$DEPLOYMENT_URL/manifest.webmanifest" "200"
test_endpoint "Service Worker" "$DEPLOYMENT_URL/sw.js" "200"

# Test 3: Check for blank page (should have content)
echo -e "\n${BLUE}[3/7] Content Presence${NC}"
test_content "Page has root div" "$DEPLOYMENT_URL" '<div id="root">'
test_content "Page has scripts" "$DEPLOYMENT_URL" '<script type="module"'

# Test 4: Check for JavaScript errors in meta tags
echo -e "\n${BLUE}[4/7] Meta Tags${NC}"
test_content "Has viewport meta" "$DEPLOYMENT_URL" '<meta name="viewport"'
test_content "Has title" "$DEPLOYMENT_URL" '<title>APEX Business Systems'

# Test 5: Security headers
echo -e "\n${BLUE}[5/7] Security Headers${NC}"
echo -ne "Checking CSP header... "
csp_header=$(curl -s -I "$DEPLOYMENT_URL" | grep -i "content-security-policy" || echo "")
if [ -n "$csp_header" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARN${NC} (CSP not found in response headers, may be in meta tag)"
fi

echo -ne "Checking X-Frame-Options... "
xfo_header=$(curl -s -I "$DEPLOYMENT_URL" | grep -i "x-frame-options" || echo "")
if [ -n "$xfo_header" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARN${NC} (Header not found)"
fi

# Test 6: Health endpoint (if accessible)
echo -e "\n${BLUE}[6/7] Health Check${NC}"
echo -ne "Testing /health endpoint... "
health_response=$(curl -s "$DEPLOYMENT_URL/health" 2>&1)
if echo "$health_response" | grep -q "status"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
    echo "  Response: $health_response"
else
    echo -e "${YELLOW}⚠ INFO${NC} (Health endpoint not accessible, this is normal for SPA routing)"
fi

# Test 7: Supabase connectivity (check in page source)
echo -e "\n${BLUE}[7/7] Supabase Configuration${NC}"
test_content "Supabase URL in build" "$DEPLOYMENT_URL" "wwajmaohwcbooljdureo.supabase.co"

# Summary
echo -e "\n${BLUE}=== Verification Summary ===${NC}"
TOTAL=$((PASSED + FAILED))
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "Tests Failed: ${RED}$FAILED${NC}"
fi
echo -e "Total Tests: $TOTAL"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All critical tests passed!${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Open $DEPLOYMENT_URL in a browser"
    echo "  2. Check browser console for JavaScript errors"
    echo "  3. Verify user authentication works"
    echo "  4. Test core features (links, files, etc.)"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed. Review the output above.${NC}"
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  1. Check Vercel build logs"
    echo "  2. Verify environment variables are set"
    echo "  3. Review VERCEL_DEPLOYMENT_GUIDE.md"
    echo "  4. Check browser console for errors"
    exit 1
fi
