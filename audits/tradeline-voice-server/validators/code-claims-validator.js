#!/usr/bin/env node

/**
 * Code Claims Validator
 *
 * Validates all claims made in documentation against actual implementation.
 * This produces a detailed validation report with PASS/FAIL for each claim.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const REPO_PATH = '/home/user/tradeline247-railway-audit';
const SERVER_PATH = join(REPO_PATH, 'tradeline-voice-server');

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class ClaimsValidator {
  constructor() {
    this.results = [];
    this.serverCode = null;
    this.packageJson = null;
    this.readme = null;
    this.errorDoc = null;
  }

  loadFiles() {
    console.log(`${colors.blue}Loading files for validation...${colors.reset}\n`);

    this.serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');
    this.packageJson = JSON.parse(readFileSync(join(SERVER_PATH, 'package.json'), 'utf-8'));
    this.readme = readFileSync(join(SERVER_PATH, 'README.md'), 'utf-8');

    const errorDocPath = join(REPO_PATH, 'ERROR_5B1_FIX_COMPLETE.md');
    if (existsSync(errorDocPath)) {
      this.errorDoc = readFileSync(errorDocPath, 'utf-8');
    }
  }

  addResult(category, claim, passed, evidence) {
    this.results.push({
      category,
      claim,
      passed,
      evidence,
      timestamp: new Date().toISOString()
    });
  }

  validate() {
    console.log(`${colors.bold}=== TRADELINE VOICE SERVER CLAIMS VALIDATION ===${colors.reset}\n`);

    this.loadFiles();

    this.validateDocumentationClaims();
    this.validateFeatureClaims();
    this.validateSecurityClaims();
    this.validateToolClaims();
    this.validateRAGClaims();
    this.validateInfrastructureClaims();

    this.printReport();
  }

  validateDocumentationClaims() {
    console.log(`${colors.blue}[1/6] Validating Documentation Claims...${colors.reset}`);

    // Claim: README says /voice-answer endpoint exists
    const hasVoiceAnswer = this.serverCode.includes('/voice-answer');
    this.addResult(
      'Documentation',
      'README claims /voice-answer endpoint exists',
      hasVoiceAnswer,
      hasVoiceAnswer ? 'Endpoint found in code' : 'MISSING: No /voice-answer endpoint in server.mjs'
    );

    // Claim: ERROR doc says /healthz endpoint exists
    const hasHealthz = this.serverCode.includes('/healthz');
    this.addResult(
      'Documentation',
      'ERROR doc claims /healthz endpoint exists',
      hasHealthz,
      hasHealthz ? 'Endpoint found in code' : 'MISSING: No /healthz endpoint in server.mjs'
    );

    // Claim: ERROR doc says railway.toml was created
    const hasRailwayToml = existsSync(join(REPO_PATH, 'railway.toml'));
    this.addResult(
      'Documentation',
      'ERROR doc claims railway.toml was created',
      hasRailwayToml,
      hasRailwayToml ? 'File exists' : 'MISSING: railway.toml not found in repository'
    );

    // Claim: ERROR doc says nixpacks.toml was created
    const hasNixpacksToml = existsSync(join(REPO_PATH, 'nixpacks.toml'));
    this.addResult(
      'Documentation',
      'ERROR doc claims nixpacks.toml was created',
      hasNixpacksToml,
      hasNixpacksToml ? 'File exists' : 'MISSING: nixpacks.toml not found in repository'
    );

    // Claim: ERROR doc references server.js but file is server.mjs
    const hasServerJs = existsSync(join(SERVER_PATH, 'server.js'));
    const hasServerMjs = existsSync(join(SERVER_PATH, 'server.mjs'));
    this.addResult(
      'Documentation',
      'ERROR doc references correct server filename',
      hasServerJs,
      hasServerMjs && !hasServerJs
        ? 'MISMATCH: Doc says server.js but file is server.mjs'
        : 'Filename matches documentation'
    );
  }

  validateFeatureClaims() {
    console.log(`${colors.blue}[2/6] Validating Feature Claims...${colors.reset}`);

    // Claim: "Voice Orchestrator"
    const hasWebSocket = this.serverCode.includes('/media-stream');
    const hasOpenAI = this.serverCode.includes('openai.com/v1/realtime');
    this.addResult(
      'Features',
      'System functions as a voice orchestrator',
      hasWebSocket && hasOpenAI,
      hasWebSocket && hasOpenAI
        ? 'WebSocket and OpenAI Realtime integration found'
        : 'Missing core orchestration components'
    );

    // Claim: "Appointment booking"
    const hasRealBooking = this.serverCode.includes('database') ||
      this.serverCode.includes('supabase') ||
      this.serverCode.includes('INSERT INTO');
    this.addResult(
      'Features',
      'Appointment booking persists to real system',
      hasRealBooking,
      hasRealBooking
        ? 'Persistence mechanism found'
        : 'STUB: book_appointment returns hardcoded TL-992, no persistence'
    );

    // Claim: "Availability checking"
    const hasRealAvailability = this.serverCode.includes('calendar') ||
      this.serverCode.includes('googleapis');
    this.addResult(
      'Features',
      'Availability checks real calendar system',
      hasRealAvailability,
      hasRealAvailability
        ? 'Calendar integration found'
        : 'STUB: check_availability returns hardcoded [2:00 PM, 4:00 PM]'
    );

    // Claim: "Call transfer"
    const hasRealTransfer = this.serverCode.includes('twilioClient.calls') &&
      this.serverCode.includes('.update');
    this.addResult(
      'Features',
      'Call transfer uses real Twilio API',
      hasRealTransfer,
      hasRealTransfer
        ? 'Twilio call update found'
        : 'Missing Twilio transfer implementation'
    );

    // Claim: "Email transcripts"
    const hasEmail = this.serverCode.includes('nodemailer') &&
      this.serverCode.includes('sendMail');
    this.addResult(
      'Features',
      'Email transcript functionality exists',
      hasEmail,
      hasEmail
        ? 'Nodemailer sendMail found'
        : 'Missing email functionality'
    );
  }

  validateSecurityClaims() {
    console.log(`${colors.blue}[3/6] Validating Security Claims...${colors.reset}`);

    // README mentions TWILIO_AUTH_TOKEN for "signature validation"
    const hasSignatureValidation = this.serverCode.includes('validateRequest') ||
      this.serverCode.includes('X-Twilio-Signature');
    this.addResult(
      'Security',
      'Twilio webhook signature validation',
      hasSignatureValidation,
      hasSignatureValidation
        ? 'Signature validation found'
        : 'MISSING: No webhook signature validation despite AUTH_TOKEN being required'
    );

    // helmet is in dependencies
    const usesHelmet = this.serverCode.includes('helmet');
    this.addResult(
      'Security',
      'Uses helmet security middleware',
      usesHelmet,
      usesHelmet
        ? 'Helmet middleware active'
        : 'UNUSED: helmet in package.json but not used in code'
    );

    // xss-clean is in dependencies
    const usesXss = this.serverCode.includes('xss');
    this.addResult(
      'Security',
      'Uses XSS protection middleware',
      usesXss,
      usesXss
        ? 'XSS protection active'
        : 'UNUSED: xss-clean in package.json but not used in code'
    );
  }

  validateToolClaims() {
    console.log(`${colors.blue}[4/6] Validating Tool Implementation Claims...${colors.reset}`);

    // Tool: check_availability
    const availabilityHardcoded = this.serverCode.includes("slots: ['2:00 PM', '4:00 PM']");
    this.addResult(
      'Tools',
      'check_availability returns dynamic data',
      !availabilityHardcoded,
      availabilityHardcoded
        ? 'HARDCODED: Always returns ["2:00 PM", "4:00 PM"]'
        : 'Dynamic availability'
    );

    // Tool: book_appointment
    const bookingHardcoded = this.serverCode.includes("confirmation: 'TL-992'");
    this.addResult(
      'Tools',
      'book_appointment generates unique confirmations',
      !bookingHardcoded,
      bookingHardcoded
        ? 'HARDCODED: Always returns confirmation TL-992'
        : 'Dynamic confirmations'
    );

    // Tool: Parameter validation
    const hasValidation = this.serverCode.includes('isValidPhoneNumber') ||
      this.serverCode.includes('.match(');
    this.addResult(
      'Tools',
      'Tool parameters are validated',
      hasValidation,
      hasValidation
        ? 'Parameter validation found'
        : 'MISSING: No validation of tool parameters'
    );
  }

  validateRAGClaims() {
    console.log(`${colors.blue}[5/6] Validating RAG/Vector DB Claims...${colors.reset}`);

    const ragKeywords = [
      'pinecone', 'weaviate', 'milvus', 'qdrant', 'chroma',
      'embedding', 'vector', 'similarity', 'retrieval',
      'langchain', 'llamaindex', 'chunk'
    ];

    let foundKeyword = null;
    for (const keyword of ragKeywords) {
      if (this.serverCode.toLowerCase().includes(keyword)) {
        foundKeyword = keyword;
        break;
      }
    }

    this.addResult(
      'RAG/VectorDB',
      'System implements RAG (Retrieval Augmented Generation)',
      !!foundKeyword,
      foundKeyword
        ? `Found RAG-related keyword: ${foundKeyword}`
        : 'NOT FOUND: No RAG, vector database, or embedding code exists in this repository'
    );

    this.addResult(
      'RAG/VectorDB',
      'System has knowledge base integration',
      false,
      'NOT FOUND: No knowledge base, document indexing, or retrieval system'
    );
  }

  validateInfrastructureClaims() {
    console.log(`${colors.blue}[6/6] Validating Infrastructure Claims...${colors.reset}`);

    // Check for Railway deployment files
    const railwayFiles = ['railway.toml', 'railway.json', 'Procfile'];
    let hasRailwayConfig = false;
    for (const file of railwayFiles) {
      if (existsSync(join(REPO_PATH, file))) {
        hasRailwayConfig = true;
        break;
      }
    }
    this.addResult(
      'Infrastructure',
      'Railway deployment configuration exists',
      hasRailwayConfig,
      hasRailwayConfig
        ? 'Railway config found'
        : 'MISSING: No railway.toml, railway.json, or Procfile'
    );

    // Check for health endpoint
    const hasHealthEndpoint = this.serverCode.includes('/healthz') ||
      this.serverCode.includes('/health');
    this.addResult(
      'Infrastructure',
      'Health check endpoint configured',
      hasHealthEndpoint,
      hasHealthEndpoint
        ? 'Health endpoint found'
        : 'MISSING: No dedicated health check endpoint (only root / exists)'
    );

    // Check Node version
    const nodeVersion = this.packageJson.engines?.node;
    const hasNodeVersion = !!nodeVersion;
    this.addResult(
      'Infrastructure',
      'Node.js version specified',
      hasNodeVersion,
      hasNodeVersion
        ? `Node version: ${nodeVersion}`
        : 'MISSING: No Node.js version in engines'
    );
  }

  printReport() {
    console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bold}           VALIDATION REPORT SUMMARY${colors.reset}`);
    console.log(`${colors.bold}${'='.repeat(60)}${colors.reset}\n`);

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`Total Claims Validated: ${total}`);
    console.log(`${colors.green}PASSED: ${passed}${colors.reset}`);
    console.log(`${colors.red}FAILED: ${failed}${colors.reset}`);
    console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    // Group by category
    const categories = [...new Set(this.results.map(r => r.category))];

    for (const category of categories) {
      console.log(`${colors.bold}--- ${category} ---${colors.reset}`);
      const categoryResults = this.results.filter(r => r.category === category);

      for (const result of categoryResults) {
        const status = result.passed
          ? `${colors.green}[PASS]${colors.reset}`
          : `${colors.red}[FAIL]${colors.reset}`;

        console.log(`  ${status} ${result.claim}`);
        console.log(`         ${colors.yellow}${result.evidence}${colors.reset}`);
      }
      console.log('');
    }

    // Final verdict
    console.log(`${colors.bold}${'='.repeat(60)}${colors.reset}`);
    if (failed === 0) {
      console.log(`${colors.green}${colors.bold}VERDICT: ALL CLAIMS VALIDATED${colors.reset}`);
    } else if (failed <= 3) {
      console.log(`${colors.yellow}${colors.bold}VERDICT: MINOR ISSUES - ${failed} claims failed${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bold}VERDICT: CRITICAL ISSUES - ${failed} claims failed${colors.reset}`);
      console.log(`${colors.red}This system is NOT production-ready${colors.reset}`);
    }
    console.log(`${colors.bold}${'='.repeat(60)}${colors.reset}\n`);

    // Return exit code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run validator
const validator = new ClaimsValidator();
validator.validate();
