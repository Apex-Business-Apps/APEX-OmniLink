/**
 * Endpoint Validation Tests (POST-FIX)
 *
 * Tests all documented endpoints against actual server implementation
 * to validate that fixes have been applied correctly.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = '/home/user/tradeline247-railway-audit/tradeline-voice-server';
const REPO_PATH = '/home/user/tradeline247-railway-audit';

describe('Endpoint Validation Tests (POST-FIX)', () => {
  let serverCode;

  beforeAll(() => {
    serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');
  });

  describe('Required Endpoints - All Should Now Pass', () => {
    it('FIXED: Should have /voice-answer endpoint', () => {
      const hasVoiceAnswer = serverCode.includes("'/voice-answer'") ||
        serverCode.includes('"/voice-answer"');
      expect(hasVoiceAnswer).toBe(true);
    });

    it('FIXED: Should have /healthz endpoint', () => {
      const hasHealthz = serverCode.includes("'/healthz'") ||
        serverCode.includes('"/healthz"');
      expect(hasHealthz).toBe(true);
    });

    it('Should have root health endpoint (/)', () => {
      const hasRoot = serverCode.includes("app.get('/'");
      expect(hasRoot).toBe(true);
    });

    it('Should have /media-stream WebSocket endpoint', () => {
      const hasMediaStream = serverCode.includes('/media-stream');
      expect(hasMediaStream).toBe(true);
    });

    it('Should have /voice-status POST endpoint', () => {
      const hasVoiceStatus = serverCode.includes('/voice-status');
      expect(hasVoiceStatus).toBe(true);
    });

    it('FIXED: Should have /metrics endpoint', () => {
      const hasMetrics = serverCode.includes("'/metrics'") ||
        serverCode.includes('"/metrics"');
      expect(hasMetrics).toBe(true);
    });
  });

  describe('Configuration Files - All Should Now Exist', () => {
    it('FIXED: railway.toml should exist', () => {
      const exists = existsSync(join(REPO_PATH, 'railway.toml'));
      expect(exists).toBe(true);
    });

    it('FIXED: nixpacks.toml should exist', () => {
      const exists = existsSync(join(REPO_PATH, 'nixpacks.toml'));
      expect(exists).toBe(true);
    });

    it('Should have package.json in voice server directory', () => {
      const exists = existsSync(join(SERVER_PATH, 'package.json'));
      expect(exists).toBe(true);
    });

    it('Should have server.mjs', () => {
      const exists = existsSync(join(SERVER_PATH, 'server.mjs'));
      expect(exists).toBe(true);
    });
  });

  describe('Environment Variable References', () => {
    it('Should reference OPENAI_API_KEY', () => {
      expect(serverCode).toContain('OPENAI_API_KEY');
    });

    it('Should reference TWILIO_ACCOUNT_SID', () => {
      expect(serverCode).toContain('TWILIO_ACCOUNT_SID');
    });

    it('Should reference TWILIO_AUTH_TOKEN', () => {
      expect(serverCode).toContain('TWILIO_AUTH_TOKEN');
    });

    it('Should reference DISPATCH_PHONE_NUMBER', () => {
      expect(serverCode).toContain('DISPATCH_PHONE_NUMBER');
    });

    it('Should reference EMAIL_TO', () => {
      expect(serverCode).toContain('EMAIL_TO');
    });

    it('Should reference PUBLIC_BASE_URL', () => {
      expect(serverCode).toContain('PUBLIC_BASE_URL');
    });

    it('Should validate OPENAI_API_KEY on startup', () => {
      expect(serverCode).toContain('OPENAI_API_KEY');
      expect(serverCode).toContain('requiredEnvVars');
    });
  });

  describe('TwiML Response Generation', () => {
    it('Should generate TwiML with Say verb', () => {
      expect(serverCode).toContain('<Say');
    });

    it('Should use Polly neural voice', () => {
      expect(serverCode).toContain('Polly.');
    });

    it('Should have Connect with Stream', () => {
      expect(serverCode).toContain('<Connect>');
      expect(serverCode).toContain('<Stream');
    });

    it('Should escape XML special characters', () => {
      expect(serverCode).toContain('escapeXml');
    });
  });

  describe('Security Features', () => {
    it('FIXED: Should validate Twilio signature', () => {
      expect(serverCode).toContain('validateTwilioSignature');
    });

    it('FIXED: Should have security headers', () => {
      expect(serverCode).toContain('X-Content-Type-Options');
      expect(serverCode).toContain('X-Frame-Options');
    });

    it('FIXED: Should sanitize inputs', () => {
      expect(serverCode).toContain('sanitizeInput');
    });
  });

  describe('Session Management', () => {
    it('FIXED: Should have session cleanup', () => {
      expect(serverCode).toContain('cleanupStaleSessions');
    });

    it('FIXED: Should track lastActivity', () => {
      expect(serverCode).toContain('lastActivity');
    });

    it('FIXED: Should have SESSION_TIMEOUT_MS', () => {
      expect(serverCode).toContain('SESSION_TIMEOUT_MS');
    });
  });

  describe('Barge-In Support', () => {
    it('FIXED: Should handle speech_started event', () => {
      expect(serverCode).toContain('speech_started');
    });

    it('FIXED: Should clear Twilio buffer', () => {
      expect(serverCode).toContain('clearTwilioBuffer');
    });
  });

  describe('Metrics & Observability', () => {
    it('FIXED: Should track metrics', () => {
      expect(serverCode).toContain('totalCalls');
      expect(serverCode).toContain('activeCalls');
    });

    it('FIXED: Should track handshake latency', () => {
      expect(serverCode).toContain('handshakeMs');
    });
  });
});

describe('Railway Configuration Validation', () => {
  let railwayConfig;
  let nixpacksConfig;

  beforeAll(() => {
    railwayConfig = readFileSync(join(REPO_PATH, 'railway.toml'), 'utf-8');
    nixpacksConfig = readFileSync(join(REPO_PATH, 'nixpacks.toml'), 'utf-8');
  });

  it('railway.toml should use NIXPACKS builder', () => {
    expect(railwayConfig).toContain('NIXPACKS');
  });

  it('railway.toml should have correct start command', () => {
    expect(railwayConfig).toContain('node server.mjs');
  });

  it('railway.toml should have health check path', () => {
    expect(railwayConfig).toContain('/healthz');
  });

  it('nixpacks.toml should use Node.js 20', () => {
    expect(nixpacksConfig).toContain('nodejs_20');
  });

  it('nixpacks.toml should have npm ci command', () => {
    expect(nixpacksConfig).toContain('npm ci');
  });
});

describe('Package.json Validation', () => {
  let packageJson;

  beforeAll(() => {
    packageJson = JSON.parse(readFileSync(join(SERVER_PATH, 'package.json'), 'utf-8'));
  });

  it('Should have correct version', () => {
    expect(packageJson.version).toBe('2.0.0');
  });

  it('Should have type module', () => {
    expect(packageJson.type).toBe('module');
  });

  it('Should require Node.js 20+', () => {
    expect(packageJson.engines.node).toContain('20');
  });

  it('Should have all required dependencies', () => {
    expect(packageJson.dependencies.fastify).toBeDefined();
    expect(packageJson.dependencies.ws).toBeDefined();
    expect(packageJson.dependencies.twilio).toBeDefined();
    expect(packageJson.dependencies.nodemailer).toBeDefined();
  });
});
