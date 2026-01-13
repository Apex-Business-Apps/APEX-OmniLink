#!/usr/bin/env node
/**
 * Static Asset Access Smoke Test
 *
 * Validates that critical static assets are accessible from the deployed/preview server.
 * Catches issues like:
 * - manifest.webmanifest returning 401/403 (auth misconfiguration)
 * - Missing or broken favicon
 * - JS bundles not accessible
 *
 * @see docs/CI_RUNTIME_GATES.md
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const DIST_DIR = './dist';
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function log(status, message) {
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
  const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow;
  console.log(`${color}${icon}${colors.reset} ${message}`);
}

async function checkAsset(url, description, expectStatus = 200) {
  try {
    const headers = {
      'User-Agent': 'OmniLink-APEX-CI-AssetCheck/1.0',
    };

    // Add Vercel protection bypass header if available
    if (VERCEL_BYPASS_SECRET) {
      headers['x-vercel-protection-bypass'] = VERCEL_BYPASS_SECRET;
      headers['x-vercel-set-bypass-cookie'] = 'true';
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (response.status === expectStatus) {
      log('pass', `${description}: ${response.status}`);
      return true;
    } else if (response.status === 401 || response.status === 403) {
      log('fail', `${description}: ${response.status} (AUTHENTICATION ERROR - deployment misconfigured)`);
      return false;
    } else {
      log('fail', `${description}: expected ${expectStatus}, got ${response.status}`);
      return false;
    }
  } catch (error) {
    log('fail', `${description}: ${error.message}`);
    return false;
  }
}

async function findFirstJsBundle() {
  const assetsDir = path.join(DIST_DIR, 'assets', 'js');

  if (!fs.existsSync(assetsDir)) {
    return null;
  }

  const files = fs.readdirSync(assetsDir);
  const jsFile = files.find((f) => f.endsWith('.js'));
  return jsFile ? `/assets/js/${jsFile}` : null;
}

async function main() {
  console.log('\n📦 OmniLink APEX - Static Asset Access Check');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log('─'.repeat(50));

  const results = [];

  // Critical assets that MUST return 200
  const criticalAssets = [
    { path: '/manifest.webmanifest', description: 'PWA Manifest' },
    { path: '/favicon.ico', description: 'Favicon' },
    { path: '/', description: 'Index HTML' },
  ];

  for (const asset of criticalAssets) {
    const passed = await checkAsset(`${BASE_URL}${asset.path}`, asset.description);
    results.push({ ...asset, passed });
  }

  // Check a JS bundle if dist exists
  const jsBundle = await findFirstJsBundle();
  if (jsBundle) {
    const passed = await checkAsset(`${BASE_URL}${jsBundle}`, `JS Bundle (${jsBundle})`);
    results.push({ path: jsBundle, description: 'JS Bundle', passed });
  } else {
    log('warn', 'No dist/assets/js found - skipping bundle check (run after build)');
  }

  // Check CSS
  const cssDir = path.join(DIST_DIR, 'assets', 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir);
    const cssFile = cssFiles.find((f) => f.endsWith('.css'));
    if (cssFile) {
      const cssPath = `/assets/css/${cssFile}`;
      const passed = await checkAsset(`${BASE_URL}${cssPath}`, `CSS Bundle (${cssFile})`);
      results.push({ path: cssPath, description: 'CSS Bundle', passed });
    }
  }

  console.log('─'.repeat(50));

  // Summary
  const failed = results.filter((r) => !r.passed);
  const passed = results.filter((r) => r.passed);

  console.log(`\n📊 Results: ${passed.length} passed, ${failed.length} failed\n`);

  if (failed.length > 0) {
    console.log(`${colors.red}FAILED ASSETS:${colors.reset}`);
    failed.forEach((f) => console.log(`   - ${f.path}: ${f.description}`));
    console.log('\n');
    process.exit(1);
  }

  console.log(`${colors.green}All critical assets accessible!${colors.reset}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Asset check failed:', err);
  process.exit(1);
});
