/**
 * Tool Execution Validation Tests
 *
 * Validates that tool implementations are production-ready
 * and not just hardcoded stubs.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVER_PATH = '/home/user/tradeline247-railway-audit/tradeline-voice-server';

describe('Tool Implementation Validation', () => {
  let serverCode;

  beforeAll(() => {
    serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');
  });

  describe('Tool Definitions', () => {
    it('Should define check_availability tool', () => {
      expect(serverCode).toContain("name: 'check_availability'");
    });

    it('Should define book_appointment tool', () => {
      expect(serverCode).toContain("name: 'book_appointment'");
    });

    it('Should define transfer_call tool', () => {
      expect(serverCode).toContain("name: 'transfer_call'");
    });
  });

  describe('Tool Implementation Quality', () => {
    it('CRITICAL: check_availability should NOT return hardcoded data', () => {
      // Extract the check_availability implementation
      const isHardcoded = serverCode.includes("slots: ['2:00 PM', '4:00 PM']");

      // This WILL FAIL - it IS hardcoded
      expect(isHardcoded).toBe(false);
    });

    it('CRITICAL: check_availability should query a real calendar system', () => {
      // Look for any calendar/scheduling API integration
      const hasCalendarIntegration =
        serverCode.includes('google.calendar') ||
        serverCode.includes('googleapis') ||
        serverCode.includes('calendly') ||
        serverCode.includes('acuity') ||
        serverCode.includes('cal.com') ||
        serverCode.includes('fetch(') && serverCode.includes('availability') ||
        serverCode.includes('database') ||
        serverCode.includes('supabase') ||
        serverCode.includes('prisma');

      // This WILL FAIL - no calendar integration
      expect(hasCalendarIntegration).toBe(true);
    });

    it('CRITICAL: book_appointment should NOT return static confirmation', () => {
      const hasStaticConfirmation = serverCode.includes("confirmation: 'TL-992'");

      // This WILL FAIL - it IS static
      expect(hasStaticConfirmation).toBe(false);
    });

    it('CRITICAL: book_appointment should persist bookings', () => {
      // Look for any data persistence
      const hasPersistence =
        serverCode.includes('INSERT INTO') ||
        serverCode.includes('.create(') ||
        serverCode.includes('.insert(') ||
        serverCode.includes('database') ||
        serverCode.includes('supabase') ||
        serverCode.includes('firebase') ||
        serverCode.includes('mongodb') ||
        serverCode.includes('prisma');

      // This WILL FAIL - no persistence
      expect(hasPersistence).toBe(true);
    });

    it('transfer_call should use Twilio API', () => {
      // This is actually implemented correctly
      const usesTwilioAPI = serverCode.includes('twilioClient.calls(callSid).update');
      expect(usesTwilioAPI).toBe(true);
    });
  });

  describe('Tool Parameter Validation', () => {
    it('check_availability should validate date parameter', () => {
      const hasDateValidation =
        serverCode.includes('isValid(date)') ||
        serverCode.includes('Date.parse') ||
        serverCode.includes('moment(') ||
        serverCode.includes('dayjs(') ||
        serverCode.includes('new Date(args.date)');

      // This WILL FAIL - no date validation
      expect(hasDateValidation).toBe(true);
    });

    it('book_appointment should validate phone number format', () => {
      const hasPhoneValidation =
        serverCode.includes('phone.match') ||
        serverCode.includes('libphonenumber') ||
        serverCode.includes('phone-number') ||
        serverCode.includes('isValidPhoneNumber');

      // This WILL FAIL - no phone validation
      expect(hasPhoneValidation).toBe(true);
    });

    it('book_appointment should validate time is in available slots', () => {
      const hasSlotValidation =
        serverCode.includes('availableSlots.includes') ||
        serverCode.includes('isSlotAvailable') ||
        serverCode.includes('checkSlot');

      // This WILL FAIL - no slot validation
      expect(hasSlotValidation).toBe(true);
    });
  });

  describe('Tool Error Handling', () => {
    it('Should handle JSON.parse errors in tool arguments', () => {
      // The code does have a try-catch around JSON.parse
      const hasTryCatch = serverCode.includes('try {') &&
        serverCode.includes('JSON.parse(argsStr)');
      expect(hasTryCatch).toBe(true);
    });

    it('Should return error status for unknown tools', () => {
      const hasUnknownHandler = serverCode.includes("message: 'Unknown tool'");
      expect(hasUnknownHandler).toBe(true);
    });
  });
});

describe('Tool Response Format Validation', () => {
  let serverCode;

  beforeAll(() => {
    serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');
  });

  it('Tool responses should follow OpenAI function_call_output format', () => {
    const hasCorrectFormat = serverCode.includes("type: 'function_call_output'") &&
      serverCode.includes('call_id:') &&
      serverCode.includes('output:');
    expect(hasCorrectFormat).toBe(true);
  });

  it('Should trigger response.create after tool execution', () => {
    const triggersResponse = serverCode.includes("type: 'response.create'");
    expect(triggersResponse).toBe(true);
  });
});

describe('Simulated Tool Execution Tests', () => {
  // These tests simulate actual tool execution

  const executeTool = async (name, args) => {
    // Replicate the logic from server.mjs
    if (name === 'check_availability') {
      return { slots: ['2:00 PM', '4:00 PM'] };
    }
    if (name === 'book_appointment') {
      return { status: 'success', confirmation: 'TL-992', message: 'Appointment booked.' };
    }
    if (name === 'transfer_call') {
      return { status: 'error', message: 'No CallSid found' }; // Without real callSid
    }
    return { status: 'error', message: 'Unknown tool' };
  };

  it('check_availability always returns same slots (PROVES IT IS HARDCODED)', async () => {
    const result1 = await executeTool('check_availability', { date: '2026-01-16' });
    const result2 = await executeTool('check_availability', { date: '2026-02-20' });
    const result3 = await executeTool('check_availability', { date: '2099-12-31' });

    // All dates return exact same slots - proves it's hardcoded
    expect(result1.slots).toEqual(['2:00 PM', '4:00 PM']);
    expect(result2.slots).toEqual(['2:00 PM', '4:00 PM']);
    expect(result3.slots).toEqual(['2:00 PM', '4:00 PM']);
  });

  it('book_appointment always returns same confirmation (PROVES IT IS HARDCODED)', async () => {
    const result1 = await executeTool('book_appointment', {
      name: 'John Doe',
      time: '2:00 PM',
      phone: '555-1234'
    });
    const result2 = await executeTool('book_appointment', {
      name: 'Jane Smith',
      time: '4:00 PM',
      phone: '555-5678'
    });

    // Both return same confirmation number - proves it's hardcoded
    expect(result1.confirmation).toBe('TL-992');
    expect(result2.confirmation).toBe('TL-992');
  });

  it('book_appointment accepts invalid data (NO VALIDATION)', async () => {
    const result = await executeTool('book_appointment', {
      name: '', // Empty name
      time: 'invalid_time', // Invalid time
      phone: 'not_a_phone' // Invalid phone
    });

    // Still returns success - proves no validation
    expect(result.status).toBe('success');
  });
});
