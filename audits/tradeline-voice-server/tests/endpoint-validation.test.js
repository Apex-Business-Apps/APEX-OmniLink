/**
 * Endpoint Validation Tests
 *
 * Tests all documented endpoints against actual server implementation
 * to validate claims made in documentation match reality.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = '/home/user/tradeline247-railway-audit/tradeline-voice-server';

describe('Endpoint Validation Tests', () => {
  let serverCode;
  let readmeContent;
  let errorDocContent;

  beforeAll(() => {
    // Load server code
    serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');
    readmeContent = readFileSync(join(SERVER_PATH, 'README.md'), 'utf-8');

    const errorDocPath = '/home/user/tradeline247-railway-audit/ERROR_5B1_FIX_COMPLETE.md';
    if (existsSync(errorDocPath)) {
      errorDocContent = readFileSync(errorDocPath, 'utf-8');
    }
  });

  describe('Documented Endpoints vs Implementation', () => {
    it('CRITICAL: Should have /voice-answer endpoint (documented in README)', () => {
      // README line 35 states: "Point your Twilio Phone Number's Voice URL to `https://<PUBLIC_BASE_URL>/voice-answer`"
      const hasVoiceAnswer = serverCode.includes("'/voice-answer'") ||
        serverCode.includes('"/voice-answer"') ||
        serverCode.includes('/voice-answer');

      // This WILL FAIL - demonstrating the documentation mismatch
      expect(hasVoiceAnswer).toBe(true);
    });

    it('CRITICAL: Should have /healthz endpoint (documented in ERROR_5B1_FIX_COMPLETE)', () => {
      // ERROR doc states: "curl https://your-railway-url.railway.app/healthz"
      const hasHealthz = serverCode.includes("'/healthz'") ||
        serverCode.includes('"/healthz"') ||
        serverCode.includes('/healthz');

      // This WILL FAIL - demonstrating the documentation mismatch
      expect(hasHealthz).toBe(true);
    });

    it('Should have root health endpoint (/)', () => {
      const hasRootEndpoint = serverCode.includes("app.get('/'");
      expect(hasRootEndpoint).toBe(true);
    });

    it('Should have /media-stream WebSocket endpoint', () => {
      const hasMediaStream = serverCode.includes('/media-stream');
      expect(hasMediaStream).toBe(true);
    });

    it('Should have /voice-status POST endpoint', () => {
      const hasVoiceStatus = serverCode.includes('/voice-status');
      expect(hasVoiceStatus).toBe(true);
    });
  });

  describe('Configuration Files Existence', () => {
    const repoRoot = '/home/user/tradeline247-railway-audit';

    it('CRITICAL: railway.toml should exist (claimed in ERROR_5B1_FIX_COMPLETE)', () => {
      // ERROR doc says: "Created railway.toml"
      const exists = existsSync(join(repoRoot, 'railway.toml'));
      // This WILL FAIL - file does not exist
      expect(exists).toBe(true);
    });

    it('CRITICAL: nixpacks.toml should exist (claimed in ERROR_5B1_FIX_COMPLETE)', () => {
      // ERROR doc says: "Created nixpacks.toml"
      const exists = existsSync(join(repoRoot, 'nixpacks.toml'));
      // This WILL FAIL - file does not exist
      expect(exists).toBe(true);
    });

    it('Should have package.json in voice server directory', () => {
      const exists = existsSync(join(SERVER_PATH, 'package.json'));
      expect(exists).toBe(true);
    });

    it('Should have server.mjs (NOT server.js as documented)', () => {
      const hasMjs = existsSync(join(SERVER_PATH, 'server.mjs'));
      const hasJs = existsSync(join(SERVER_PATH, 'server.js'));

      expect(hasMjs).toBe(true);
      // ERROR doc references "node server.js" but file is server.mjs
      expect(hasJs).toBe(false);
    });
  });

  describe('Required Environment Variables', () => {
    const requiredVars = [
      'OPENAI_API_KEY',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'DISPATCH_PHONE_NUMBER',
      'EMAIL_TO',
      'EMAIL_USER',
      'EMAIL_PASS'
    ];

    requiredVars.forEach(varName => {
      it(`Should reference ${varName} in server code`, () => {
        const referenced = serverCode.includes(varName);
        expect(referenced).toBe(true);
      });
    });

    it('Should validate OPENAI_API_KEY on startup', () => {
      const hasValidation = serverCode.includes('if (!OPENAI_API_KEY)');
      expect(hasValidation).toBe(true);
    });

    it('MISSING: Should validate TWILIO credentials on startup', () => {
      const hasValidation = serverCode.includes('if (!TWILIO_ACCOUNT_SID)') ||
        serverCode.includes('if (!TWILIO_AUTH_TOKEN)');
      // This WILL FAIL - no Twilio credential validation
      expect(hasValidation).toBe(true);
    });
  });

  describe('Endpoint Response Analysis', () => {
    it('Root endpoint should return service name in response', () => {
      const hasServiceName = serverCode.includes("service: 'TradeLine 24/7 Voice Orchestrator'");
      expect(hasServiceName).toBe(true);
    });

    it('/voice-status should handle call completion statuses', () => {
      const hasStatusHandling = serverCode.includes('completed') &&
        serverCode.includes('failed') &&
        serverCode.includes('busy') &&
        serverCode.includes('no-answer');
      expect(hasStatusHandling).toBe(true);
    });
  });
});

describe('TwiML Response Analysis', () => {
  let serverCode;

  beforeAll(() => {
    serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');
  });

  it('Should have TwiML for call transfer', () => {
    const hasTwiml = serverCode.includes('<Response>') &&
      serverCode.includes('<Dial>') &&
      serverCode.includes('</Response>');
    expect(hasTwiml).toBe(true);
  });

  it('MISSING: Should have TwiML for initial voice answer', () => {
    // A real voice server needs TwiML to start the media stream connection
    const hasConnectTwiml = serverCode.includes('<Connect>') ||
      serverCode.includes('<Stream');
    // This WILL FAIL - no initial connection TwiML
    expect(hasConnectTwiml).toBe(true);
  });
});
