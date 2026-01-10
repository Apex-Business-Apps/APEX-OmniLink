#!/usr/bin/env node
/**
 * React Singleton Detector
 *
 * Validates that only ONE version of React and ReactDOM exists in the dependency tree.
 * Multiple React versions cause the infamous "Invalid hook call" and "createContext" errors
 * that result in blank page deployments.
 *
 * @see https://reactjs.org/warnings/invalid-hook-call-warning.html
 * @see docs/CI_RUNTIME_GATES.md
 */

import { execSync } from 'child_process';

// ANSI colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function extractVersions(depTree, packageName) {
  const versions = new Set();

  function traverse(node, path = []) {
    if (!node || typeof node !== 'object') return;

    // Check if this node is the package we're looking for
    if (node.version && path[path.length - 1] === packageName) {
      versions.add(node.version);
    }

    // Check dependencies
    if (node.dependencies) {
      for (const [name, dep] of Object.entries(node.dependencies)) {
        traverse(dep, [...path, name]);
      }
    }
  }

  traverse(depTree);
  return Array.from(versions);
}

function findDuplicatePaths(depTree, packageName, targetVersion) {
  const paths = [];

  function traverse(node, path = []) {
    if (!node || typeof node !== 'object') return;

    if (node.version && path[path.length - 1] === packageName && node.version !== targetVersion) {
      paths.push({
        path: path.join(' → '),
        version: node.version,
      });
    }

    if (node.dependencies) {
      for (const [name, dep] of Object.entries(node.dependencies)) {
        traverse(dep, [...path, name]);
      }
    }
  }

  traverse(depTree);
  return paths;
}

async function main() {
  console.log('\n🔍 React Singleton Check');
  console.log('─'.repeat(50));

  let depTree;
  try {
    const output = execSync('npm ls react react-dom --json --all 2>/dev/null', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large trees
    });
    depTree = JSON.parse(output);
  } catch (error) {
    // npm ls returns non-zero if there are peer dep issues, but JSON might still be valid
    if (error.stdout) {
      try {
        depTree = JSON.parse(error.stdout);
      } catch {
        console.error(`${colors.red}✗${colors.reset} Failed to parse npm dependency tree`);
        process.exit(1);
      }
    } else {
      console.error(`${colors.red}✗${colors.reset} Failed to run npm ls:`, error.message);
      process.exit(1);
    }
  }

  // Extract all versions of react and react-dom
  const reactVersions = extractVersions(depTree, 'react');
  const reactDomVersions = extractVersions(depTree, 'react-dom');

  console.log(`\n📦 react versions found: ${reactVersions.length}`);
  reactVersions.forEach((v) => console.log(`   - ${v}`));

  console.log(`\n📦 react-dom versions found: ${reactDomVersions.length}`);
  reactDomVersions.forEach((v) => console.log(`   - ${v}`));

  let hasError = false;

  // Check for multiple React versions
  if (reactVersions.length > 1) {
    console.log(`\n${colors.red}✗ DUPLICATE REACT DETECTED${colors.reset}`);
    console.log('  Multiple versions of React will cause "Invalid hook call" errors.\n');

    const primaryVersion = reactVersions[0];
    const duplicates = findDuplicatePaths(depTree, 'react', primaryVersion);
    duplicates.forEach((dup) => {
      console.log(`  ${colors.yellow}→${colors.reset} ${dup.path}`);
      console.log(`    Version: ${dup.version} (expected: ${primaryVersion})\n`);
    });

    hasError = true;
  }

  // Check for multiple ReactDOM versions
  if (reactDomVersions.length > 1) {
    console.log(`\n${colors.red}✗ DUPLICATE REACT-DOM DETECTED${colors.reset}`);
    console.log('  Multiple versions of ReactDOM will cause context errors.\n');

    const primaryVersion = reactDomVersions[0];
    const duplicates = findDuplicatePaths(depTree, 'react-dom', primaryVersion);
    duplicates.forEach((dup) => {
      console.log(`  ${colors.yellow}→${colors.reset} ${dup.path}`);
      console.log(`    Version: ${dup.version} (expected: ${primaryVersion})\n`);
    });

    hasError = true;
  }

  // Check version mismatch between react and react-dom
  if (reactVersions.length === 1 && reactDomVersions.length === 1) {
    const reactMajor = reactVersions[0].split('.')[0];
    const reactDomMajor = reactDomVersions[0].split('.')[0];

    if (reactMajor !== reactDomMajor) {
      console.log(`\n${colors.red}✗ REACT/REACT-DOM VERSION MISMATCH${colors.reset}`);
      console.log(`  react: ${reactVersions[0]}`);
      console.log(`  react-dom: ${reactDomVersions[0]}`);
      console.log('  These should be the same major version.\n');
      hasError = true;
    }
  }

  console.log('─'.repeat(50));

  if (hasError) {
    console.log(`\n${colors.red}FAILED:${colors.reset} React singleton check failed`);
    console.log('Fix: Run `npm dedupe` or check for conflicting peer dependencies.\n');
    process.exit(1);
  }

  console.log(`\n${colors.green}✓ React singleton check passed${colors.reset}`);
  console.log(`  react: ${reactVersions[0]}`);
  console.log(`  react-dom: ${reactDomVersions[0]}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('React singleton check failed:', err);
  process.exit(1);
});
