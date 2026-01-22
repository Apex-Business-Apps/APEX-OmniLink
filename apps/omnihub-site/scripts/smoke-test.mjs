#!/usr/bin/env node
/**
 * Smoke Test for APEX OmniHub Marketing Site
 * Verifies that each page contains expected content after build.
 *
 * Usage: node scripts/smoke-test.mjs
 *
 * Prerequisites: npm run build
 *
 * Note: Since this is a React app, content is in JS bundles, not HTML.
 * We check that HTML files exist and reference JS, then check JS for content.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '../dist');
const ASSETS_JS_DIR = resolve(DIST_DIR, 'assets/js');

// Page expectations
const PAGE_CHECKS = [
  {
    file: 'index.html',
    name: 'Home (/)',
    // Check that HTML exists and has the right structure
    htmlContains: ['<div id="root">', '<script'],
  },
  {
    file: 'demo.html',
    name: 'Demo (/demo)',
    htmlContains: ['<div id="root">', '<script'],
  },
  {
    file: 'tech-specs.html',
    name: 'Tech Specs (/tech-specs)',
    htmlContains: ['<div id="root">', '<script'],
  },
  {
    file: 'request-access.html',
    name: 'Request Access (/request-access)',
    htmlContains: ['<div id="root">', '<script'],
  },
  {
    file: 'login.html',
    name: 'Login (/login)',
    htmlContains: ['<div id="root">', '<script'],
  },
  {
    file: 'privacy.html',
    name: 'Privacy (/privacy)',
    htmlContains: ['<div id="root">', '<script'],
  },
  {
    file: 'terms.html',
    name: 'Terms (/terms)',
    htmlContains: ['<div id="root">', '<script'],
  },
];

// Content that must exist somewhere in the JS bundles
const CONTENT_CHECKS = [
  { content: 'APEX OmniHub', description: 'Brand name' },
  { content: 'Intelligence Designed', description: 'Hero title' },
  { content: 'It Sees You', description: 'Hero tagline' },
  { content: 'AI-Powered Automation', description: 'Feature highlight' },
  { content: 'Smart Integrations', description: 'Feature highlight' },
  { content: 'Advanced Analytics', description: 'Feature highlight' },
  { content: 'See It In Action', description: 'Demo page title' },
  { content: 'Single-Port Protocol', description: 'Tech spec section' },
  { content: 'Technical Specifications', description: 'Tech specs page title' },
  { content: 'Request Access', description: 'Request access page' },
  { content: 'Welcome Back', description: 'Login page title' },
  { content: 'Privacy', description: 'Privacy page' },
  { content: 'Terms', description: 'Terms page' },
];

/**
 * Helper function to log test results and update exit code
 * @param {boolean} passed - Whether the test passed
 * @param {string} passMessage - Message to display on pass
 * @param {string} failMessage - Message to display on fail
 * @returns {number} 0 if passed, 1 if failed
 */
function logTestResult(passed, passMessage, failMessage) {
  if (passed) {
    console.log(`✅ PASS: ${passMessage}`);
    return 0;
  }
  console.error(`❌ FAIL: ${failMessage}`);
  return 1;
}

let exitCode = 0;

console.log('🔍 APEX OmniHub Marketing Site - Smoke Test\n');

// Check dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error('❌ ERROR: dist/ directory not found. Run `npm run build` first.\n');
  process.exit(1);
}

// Check HTML files
console.log('📄 Checking HTML entry points...\n');

for (const check of PAGE_CHECKS) {
  const filePath = resolve(DIST_DIR, check.file);

  if (!existsSync(filePath)) {
    exitCode = logTestResult(false, '', `${check.name} - File not found: ${check.file}`);
    continue;
  }

  const content = readFileSync(filePath, 'utf-8');
  const missing = check.htmlContains.filter(s => !content.includes(s));

  exitCode |= logTestResult(
    missing.length === 0,
    check.name,
    `${check.name} - Missing HTML structure`
  );
}

// Check JS bundles for content
console.log('\n📦 Checking JS bundles for content...\n');

if (!existsSync(ASSETS_JS_DIR)) {
  console.error('❌ ERROR: assets/js directory not found');
  process.exit(1);
}

// Read all JS files
const jsFiles = readdirSync(ASSETS_JS_DIR).filter(f => f.endsWith('.js'));
const allJsContent = jsFiles
  .map(f => readFileSync(join(ASSETS_JS_DIR, f), 'utf-8'))
  .join('');

for (const check of CONTENT_CHECKS) {
  exitCode |= logTestResult(
    allJsContent.includes(check.content),
    `${check.description} ("${check.content}")`,
    `${check.description} - Missing: "${check.content}"`
  );
}

console.log('');
console.log(exitCode === 0 ? '✅ All smoke tests passed!\n' : '❌ Some smoke tests failed.\n');

process.exit(exitCode);
