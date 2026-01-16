/**
 * Security Audit Tests
 *
 * Comprehensive security validation for production voice server
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SERVER_PATH = '/home/user/tradeline247-railway-audit/tradeline-voice-server';
const REPO_PATH = '/home/user/tradeline247-railway-audit';

describe('Security Audit', () => {
  let serverCode;
  let packageJson;

  beforeAll(() => {
    serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');
    packageJson = JSON.parse(readFileSync(join(SERVER_PATH, 'package.json'), 'utf-8'));
  });

  describe('Authentication & Authorization', () => {
    it('CRITICAL: Should validate Twilio webhook signatures', () => {
      // Twilio provides X-Twilio-Signature header for webhook validation
      const hasSignatureValidation =
        serverCode.includes('X-Twilio-Signature') ||
        serverCode.includes('validateRequest') ||
        serverCode.includes('twilio.validateRequest');

      // This WILL FAIL - no signature validation
      expect(hasSignatureValidation).toBe(true);
    });

    it('CRITICAL: Should protect WebSocket endpoint', () => {
      // WebSocket should verify the connection is from Twilio
      const hasWsAuth =
        serverCode.includes('authenticate') ||
        serverCode.includes('verify') ||
        serverCode.includes('authorization');

      // This WILL FAIL - no WS authentication
      expect(hasWsAuth).toBe(true);
    });

    it('Should use Authorization header for OpenAI', () => {
      expect(serverCode).toContain('Authorization:');
      expect(serverCode).toContain('Bearer ${OPENAI_API_KEY}');
    });
  });

  describe('Input Validation', () => {
    it('MISSING: Should sanitize user input in transcripts', () => {
      const hasSanitization =
        serverCode.includes('sanitize') ||
        serverCode.includes('escape') ||
        serverCode.includes('xss');

      // This WILL FAIL - no input sanitization
      expect(hasSanitization).toBe(true);
    });

    it('MISSING: Should validate CallSid format', () => {
      const hasCallSidValidation =
        serverCode.includes('CallSid.match') ||
        serverCode.includes('isValidCallSid') ||
        serverCode.includes('CA[a-f0-9]');

      // This WILL FAIL - no CallSid validation
      expect(hasCallSidValidation).toBe(true);
    });

    it('MISSING: Should validate phone number format before transfer', () => {
      const hasPhoneValidation =
        serverCode.includes('DISPATCH_PHONE_NUMBER') &&
        (serverCode.includes('isValidPhoneNumber') ||
          serverCode.includes('.match('));

      // This WILL FAIL - no phone validation
      expect(hasPhoneValidation).toBe(true);
    });
  });

  describe('Rate Limiting & DoS Protection', () => {
    it('MISSING: Should implement rate limiting', () => {
      const hasRateLimiting =
        serverCode.includes('rateLimit') ||
        serverCode.includes('rate-limit') ||
        packageJson.dependencies['express-rate-limit'] ||
        packageJson.dependencies['fastify-rate-limit'] ||
        packageJson.dependencies['@fastify/rate-limit'];

      // This WILL FAIL - no rate limiting
      expect(hasRateLimiting).toBe(true);
    });

    it('MISSING: Should limit concurrent WebSocket connections', () => {
      const hasConnectionLimit =
        serverCode.includes('maxConnections') ||
        serverCode.includes('connectionLimit') ||
        serverCode.includes('connections.size');

      // This WILL FAIL - no connection limiting
      expect(hasConnectionLimit).toBe(true);
    });

    it('MISSING: Should implement request timeout', () => {
      const hasTimeout =
        serverCode.includes('timeout') ||
        serverCode.includes('connectionTimeout');

      // This WILL FAIL - no explicit timeout
      expect(hasTimeout).toBe(true);
    });
  });

  describe('Data Security', () => {
    it('Should use HTTPS for OpenAI connection (WSS)', () => {
      expect(serverCode).toContain('wss://');
    });

    it('MISSING: Should encrypt sensitive data at rest', () => {
      const hasEncryption =
        serverCode.includes('encrypt') ||
        serverCode.includes('crypto') ||
        serverCode.includes('cipher');

      // This WILL FAIL - no encryption
      expect(hasEncryption).toBe(true);
    });

    it('CONCERN: Session store keeps transcripts in memory', () => {
      // This is a finding, not a failure
      const storesInMemory = serverCode.includes('sessionStore = new Map()');
      expect(storesInMemory).toBe(true);
      // Memory-only storage means transcripts lost on restart
    });
  });

  describe('Secrets Management', () => {
    it('Should load secrets from environment variables', () => {
      expect(serverCode).toContain('process.env');
    });

    it('Should NOT have hardcoded secrets', () => {
      // Check for common secret patterns
      const hasHardcodedSecrets =
        serverCode.includes('sk-') || // OpenAI key pattern
        serverCode.includes('AC') && serverCode.includes('auth') && /AC[a-f0-9]{32}/i.test(serverCode) || // Twilio SID pattern
        serverCode.match(/['"][a-zA-Z0-9]{32,}['"]/); // Generic long secret

      expect(hasHardcodedSecrets).toBeFalsy();
    });

    it('Should have .gitignore for secrets', () => {
      const gitignore = existsSync(join(SERVER_PATH, '.gitignore'));
      expect(gitignore).toBe(true);
    });
  });

  describe('Security Headers', () => {
    it('Has helmet dependency for security headers', () => {
      expect(packageJson.dependencies.helmet).toBeDefined();
    });

    it('MISSING: Actually uses helmet middleware', () => {
      const usesHelmet =
        serverCode.includes('helmet(') ||
        serverCode.includes("require('helmet')") ||
        serverCode.includes("import helmet");

      // This WILL FAIL - helmet is in deps but not used
      expect(usesHelmet).toBe(true);
    });

    it('Has xss-clean dependency', () => {
      expect(packageJson.dependencies['xss-clean']).toBeDefined();
    });

    it('MISSING: Actually uses xss-clean middleware', () => {
      const usesXss =
        serverCode.includes('xss(') ||
        serverCode.includes('xssClean') ||
        serverCode.includes("require('xss-clean')");

      // This WILL FAIL - xss-clean is in deps but not used
      expect(usesXss).toBe(true);
    });
  });

  describe('Error Exposure', () => {
    it('Should NOT expose stack traces in production', () => {
      const exposesStacks =
        serverCode.includes('stack:') ||
        serverCode.includes('.stack');

      expect(exposesStacks).toBe(false);
    });

    it('Should NOT expose internal paths', () => {
      const exposesPath =
        serverCode.includes('__dirname') ||
        serverCode.includes('__filename');

      expect(exposesPath).toBe(false);
    });
  });

  describe('Dependency Security', () => {
    it('Should have reasonably recent dependencies', () => {
      // Check that major dependencies aren't ancient
      const deps = packageJson.dependencies;

      // Fastify should be recent
      expect(deps.fastify).toMatch(/^\^5\./);

      // WS should be recent
      expect(deps.ws).toMatch(/8\./);
    });

    it('Should have specific version locks', () => {
      const hasLockFile = existsSync(join(SERVER_PATH, 'package-lock.json'));
      expect(hasLockFile).toBe(true);
    });
  });
});

describe('OWASP Top 10 Checks', () => {
  let serverCode;

  beforeAll(() => {
    serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');
  });

  it('A01: Broken Access Control - Endpoints should require auth', () => {
    // WebSocket endpoint is open
    const hasAuth = serverCode.includes('authenticate') ||
      serverCode.includes('authorization');
    // WILL FAIL
    expect(hasAuth).toBe(true);
  });

  it('A03: Injection - Should sanitize tool arguments', () => {
    const hasSanitization = serverCode.includes('sanitize');
    // WILL FAIL
    expect(hasSanitization).toBe(true);
  });

  it('A07: XSS - Should escape transcript output', () => {
    const hasEscaping = serverCode.includes('escape');
    // WILL FAIL
    expect(hasEscaping).toBe(true);
  });
});
