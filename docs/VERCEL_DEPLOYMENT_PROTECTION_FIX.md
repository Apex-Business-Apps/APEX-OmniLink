# Vercel Deployment Protection Fix for CI/CD

## Problem

The preview-smoke-test job is failing with 401 errors when trying to access Vercel preview deployments:

```
GET status: 401. Attempt 0 of 30
✗ PWA Manifest: 401 (AUTHENTICATION ERROR - deployment misconfigured)
✗ Favicon: 401 (AUTHENTICATION ERROR - deployment misconfigured)
✗ Index HTML: 401 (AUTHENTICATION ERROR - deployment misconfigured)
```

## Root Cause

Vercel's **Deployment Protection** feature is enabled on your project, which requires authentication to access preview deployments. This is a security feature that prevents unauthorized access to your preview URLs, but it also blocks CI/CD automation from running tests.

## Solution

We've implemented support for Vercel's **Automation Bypass** feature, which allows CI/CD tools to access protected deployments using a special secret.

### Step 1: Generate the Bypass Secret

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **APEX-OmniHub**
3. Navigate to **Settings** → **Deployment Protection**
4. Scroll down to the **Automation Bypass** section
5. Click **"Create Secret"**
6. **Copy the generated secret** (you won't be able to see it again!)

### Step 2: Add Secret to GitHub

1. Go to your GitHub repository: https://github.com/apexbusiness-systems/APEX-OmniHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Enter the following:
   - **Name**: `VERCEL_AUTOMATION_BYPASS_SECRET`
   - **Value**: Paste the secret you copied from Vercel
5. Click **"Add secret"**

### Step 3: Verify the Fix

Once you've added the secret:

1. Create a new pull request or re-run the existing workflow
2. The `preview-smoke-test` job should now pass
3. Check the logs - you should see HTTP 200 responses instead of 401

## How It Works

### Workflow Changes

The `.github/workflows/ci-runtime-gates.yml` workflow now:

1. **Passes the bypass secret to the Vercel preview detection action**:
   ```yaml
   - name: Wait for Vercel Preview
     uses: patrickedqvist/wait-for-vercel-preview@v1.3.2
     with:
       vercel_password: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
   ```

2. **Includes the secret in test environment variables**:
   ```yaml
   - name: Run asset tests against preview
     env:
       VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
   ```

### Test Script Updates

#### Asset Check (`tests/smoke/assets-check.mjs`)

The script now adds the `x-vercel-protection-bypass` header when making requests:

```javascript
const headers = {
  'User-Agent': 'OmniLink-APEX-CI-AssetCheck/1.0',
};

// Add Vercel deployment protection bypass if secret is available
if (VERCEL_BYPASS_SECRET) {
  headers['x-vercel-protection-bypass'] = VERCEL_BYPASS_SECRET;
}
```

#### Playwright Tests (`playwright.config.ts`)

Playwright now automatically includes the bypass header in all requests:

```typescript
use: {
  baseURL: process.env.BASE_URL || 'http://localhost:4173',
  extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? {
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      }
    : {},
}
```

## Security Considerations

✅ **Secure**: The bypass secret is only stored in GitHub Secrets (encrypted at rest)
✅ **Scoped**: Only affects preview deployments, not production
✅ **Auditable**: All access is logged in Vercel's deployment logs
✅ **Revocable**: Can be regenerated in Vercel dashboard if compromised

## Alternative Approaches (Not Recommended)

### Option 1: Disable Deployment Protection
- **Pros**: No secret management needed
- **Cons**: Preview URLs become publicly accessible
- **Risk**: High - anyone with the URL can access your preview

### Option 2: Skip Preview Tests
- **Pros**: No configuration needed
- **Cons**: Misses deployment-specific issues
- **Risk**: Medium - bugs might reach production

### Option 3: Use Password Protection
- **Pros**: Simple authentication
- **Cons**: Requires password in CI, less flexible
- **Risk**: Low - but requires manual password management

## Troubleshooting

### Secret Not Working

1. **Verify secret is set correctly**:
   - Go to GitHub → Settings → Secrets → Actions
   - Confirm `VERCEL_AUTOMATION_BYPASS_SECRET` exists
   - Regenerate in Vercel if unsure about the value

2. **Check secret format**:
   - Should be a long alphanumeric string
   - No extra spaces or line breaks
   - Case-sensitive

3. **Regenerate if needed**:
   - Vercel → Settings → Deployment Protection
   - Delete old secret
   - Create new secret
   - Update GitHub secret with new value

### Still Getting 401 Errors

1. **Ensure deployment protection is actually enabled**:
   - Vercel → Settings → Deployment Protection
   - Should show "Standard Protection" or similar

2. **Check if secret is being passed**:
   - View GitHub Actions logs
   - Look for `VERCEL_AUTOMATION_BYPASS_SECRET` in environment
   - Should NOT show the actual value (masked)

3. **Verify timing**:
   - Secret must be added BEFORE the workflow runs
   - Re-run the workflow after adding the secret

### Tests Still Fail After Adding Secret

1. **Check Vercel preview deployment status**:
   - Might not be deployed yet
   - Check Vercel dashboard for deployment status

2. **Verify workflow is using latest code**:
   - Ensure PR includes the workflow changes
   - Check that `.github/workflows/ci-runtime-gates.yml` has the updates

3. **Test locally**:
   ```bash
   export VERCEL_AUTOMATION_BYPASS_SECRET="your-secret"
   export BASE_URL="https://your-preview-url.vercel.app"
   npm run test:assets
   ```

## Related Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci-runtime-gates.yml` | CI workflow with bypass support |
| `tests/smoke/assets-check.mjs` | Asset test with bypass header |
| `playwright.config.ts` | Playwright config with bypass header |
| `docs/CI_RUNTIME_GATES.md` | General CI documentation |

## Need Help?

- **Vercel Documentation**: https://vercel.com/docs/security/deployment-protection#automation-bypass
- **GitHub Secrets Guide**: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **Project Issues**: https://github.com/apexbusiness-systems/APEX-OmniHub/issues

---

**Status**: ✅ Implemented - Awaiting secret configuration
**Priority**: High - Blocks preview deployment testing
**Impact**: Fixes 401 errors on all preview smoke tests
