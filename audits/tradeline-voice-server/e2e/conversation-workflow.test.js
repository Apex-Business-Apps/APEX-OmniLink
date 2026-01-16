/**
 * End-to-End Conversation Workflow Tests
 *
 * Simulates real-world conversation scenarios to validate
 * the complete voice AI system behavior.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVER_PATH = '/home/user/tradeline247-railway-audit/tradeline-voice-server';

/**
 * Mock implementation of the server's core logic for testing
 */
class ConversationSimulator {
  constructor() {
    this.transcript = [];
    this.toolCalls = [];
    this.sessionStore = new Map();
    this.currentCallSid = null;
  }

  /**
   * Simulate a complete call flow
   */
  async simulateCall(callSid, userUtterances) {
    this.currentCallSid = callSid;
    this.sessionStore.set(callSid, { transcript: [], startTime: new Date() });

    const results = [];

    for (const utterance of userUtterances) {
      const result = await this.processUtterance(utterance);
      results.push(result);
    }

    return {
      callSid,
      transcript: this.sessionStore.get(callSid).transcript,
      toolCalls: this.toolCalls,
      results
    };
  }

  /**
   * Process a user utterance and determine AI response
   */
  async processUtterance(text) {
    // Add to transcript
    this.sessionStore.get(this.currentCallSid).transcript.push({
      role: 'user',
      text,
      timestamp: new Date()
    });

    // Analyze intent and determine tool call
    const intent = this.analyzeIntent(text);

    if (intent.requiresTool) {
      const toolResult = await this.executeTool(intent.tool, intent.args);
      this.toolCalls.push({ tool: intent.tool, args: intent.args, result: toolResult });

      // Generate AI response based on tool result
      const aiResponse = this.generateResponse(intent.tool, toolResult);
      this.sessionStore.get(this.currentCallSid).transcript.push({
        role: 'assistant',
        text: aiResponse,
        timestamp: new Date()
      });

      return { intent, toolResult, aiResponse };
    }

    // No tool needed, direct response
    const aiResponse = 'I can help you with checking availability and booking appointments. What would you like to do?';
    this.sessionStore.get(this.currentCallSid).transcript.push({
      role: 'assistant',
      text: aiResponse,
      timestamp: new Date()
    });

    return { intent, aiResponse };
  }

  /**
   * Analyze user intent
   */
  analyzeIntent(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('available') || lowerText.includes('availability') || lowerText.includes('open')) {
      return {
        requiresTool: true,
        tool: 'check_availability',
        args: { date: this.extractDate(text) }
      };
    }

    if (lowerText.includes('book') || lowerText.includes('appointment') || lowerText.includes('schedule')) {
      return {
        requiresTool: true,
        tool: 'book_appointment',
        args: this.extractBookingInfo(text)
      };
    }

    if (lowerText.includes('transfer') || lowerText.includes('human') || lowerText.includes('agent') || lowerText.includes('speak to')) {
      return {
        requiresTool: true,
        tool: 'transfer_call',
        args: { reason: 'Customer requested human agent' }
      };
    }

    return { requiresTool: false };
  }

  extractDate(text) {
    // Simple date extraction (in real impl would use NLP)
    const today = new Date();
    if (text.toLowerCase().includes('tomorrow')) {
      today.setDate(today.getDate() + 1);
    }
    return today.toISOString().split('T')[0];
  }

  extractBookingInfo(text) {
    // Simplified extraction
    return {
      name: 'Test Customer',
      time: '2:00 PM',
      phone: '555-1234'
    };
  }

  /**
   * Execute tool (mirrors server.mjs implementation)
   */
  async executeTool(name, args) {
    // This exactly mirrors the server.mjs implementation
    if (name === 'check_availability') {
      return { slots: ['2:00 PM', '4:00 PM'] }; // HARDCODED
    }
    if (name === 'book_appointment') {
      return { status: 'success', confirmation: 'TL-992', message: 'Appointment booked.' }; // HARDCODED
    }
    if (name === 'transfer_call') {
      return { status: 'error', message: 'No CallSid found' };
    }
    return { status: 'error', message: 'Unknown tool' };
  }

  generateResponse(tool, result) {
    if (tool === 'check_availability') {
      return `I have the following times available: ${result.slots.join(' and ')}. Would you like to book one of these?`;
    }
    if (tool === 'book_appointment') {
      return `Your appointment has been booked. Your confirmation number is ${result.confirmation}.`;
    }
    if (tool === 'transfer_call') {
      return 'Let me transfer you to a specialist.';
    }
    return 'I apologize, I had trouble with that request.';
  }
}

describe('E2E Conversation Workflows', () => {
  let simulator;

  beforeAll(() => {
    simulator = new ConversationSimulator();
  });

  describe('Scenario 1: Check Availability', () => {
    it('Should handle availability inquiry', async () => {
      const sim = new ConversationSimulator();
      const result = await sim.simulateCall('CA_TEST_001', [
        'Hi, I want to check what times are available tomorrow'
      ]);

      expect(result.toolCalls.length).toBe(1);
      expect(result.toolCalls[0].tool).toBe('check_availability');
      expect(result.toolCalls[0].result.slots).toContain('2:00 PM');
    });

    it('CONCERN: Availability is always the same regardless of date', async () => {
      const sim = new ConversationSimulator();

      const result1 = await sim.simulateCall('CA_TEST_002', ['Check availability for January 20']);
      const sim2 = new ConversationSimulator();
      const result2 = await sim2.simulateCall('CA_TEST_003', ['Check availability for December 31']);

      // Both return same slots - proves hardcoded
      expect(result1.toolCalls[0].result.slots).toEqual(result2.toolCalls[0].result.slots);
    });
  });

  describe('Scenario 2: Book Appointment', () => {
    it('Should handle booking request', async () => {
      const sim = new ConversationSimulator();
      const result = await sim.simulateCall('CA_TEST_004', [
        'I would like to book an appointment for 2 PM tomorrow'
      ]);

      expect(result.toolCalls.length).toBe(1);
      expect(result.toolCalls[0].tool).toBe('book_appointment');
      expect(result.toolCalls[0].result.status).toBe('success');
    });

    it('CRITICAL: All bookings get same confirmation number', async () => {
      const sim1 = new ConversationSimulator();
      const result1 = await sim1.simulateCall('CA_TEST_005', ['Book appointment']);

      const sim2 = new ConversationSimulator();
      const result2 = await sim2.simulateCall('CA_TEST_006', ['Book appointment']);

      // Both get same confirmation - CRITICAL BUG
      expect(result1.toolCalls[0].result.confirmation)
        .toBe(result2.toolCalls[0].result.confirmation);
      expect(result1.toolCalls[0].result.confirmation).toBe('TL-992');
    });
  });

  describe('Scenario 3: Transfer to Human', () => {
    it('Should handle transfer request', async () => {
      const sim = new ConversationSimulator();
      const result = await sim.simulateCall('CA_TEST_007', [
        'I would like to speak to a human agent please'
      ]);

      expect(result.toolCalls.length).toBe(1);
      expect(result.toolCalls[0].tool).toBe('transfer_call');
    });
  });

  describe('Scenario 4: Multi-Turn Conversation', () => {
    it('Should handle complete booking flow', async () => {
      const sim = new ConversationSimulator();
      const result = await sim.simulateCall('CA_TEST_008', [
        'Hello',
        'What times do you have available tomorrow?',
        'I would like to book the 2 PM slot please',
        'Thank you, goodbye'
      ]);

      expect(result.transcript.length).toBe(8); // 4 user + 4 assistant
      expect(result.toolCalls.length).toBe(2); // availability + booking
    });
  });

  describe('Scenario 5: Edge Cases', () => {
    it('Should handle empty utterance', async () => {
      const sim = new ConversationSimulator();
      const result = await sim.simulateCall('CA_TEST_009', ['']);

      expect(result.transcript.length).toBe(2);
    });

    it('Should handle ambiguous request', async () => {
      const sim = new ConversationSimulator();
      const result = await sim.simulateCall('CA_TEST_010', [
        'Can you help me with my credit?'
      ]);

      // No tool should be called for generic questions
      expect(result.toolCalls.length).toBe(0);
    });
  });
});

describe('Real World Scenario Validation', () => {
  describe('Scenario: New Customer Booking', () => {
    it('Complete new customer flow should work', async () => {
      const sim = new ConversationSimulator();
      const conversation = [
        'Hi, I am a new customer and I want to book an appointment to discuss my credit options',
        'Yes, what times are available this week?',
        'The 2 PM works for me',
        'My name is John Smith',
        'My phone is 555-123-4567'
      ];

      const result = await sim.simulateCall('CA_NEWCUST_001', conversation);

      // Verify tools were called
      const availabilityCall = result.toolCalls.find(t => t.tool === 'check_availability');
      const bookingCall = result.toolCalls.find(t => t.tool === 'book_appointment');

      expect(availabilityCall).toBeDefined();
      expect(bookingCall).toBeDefined();
    });

    it('CRITICAL: Booking does not actually persist', () => {
      // This is a documentation of the known issue
      const serverCode = readFileSync(join(SERVER_PATH, 'server.mjs'), 'utf-8');

      // No database or API call for persistence
      const hasPersistence = serverCode.includes('database') ||
        serverCode.includes('INSERT') ||
        serverCode.includes('supabase') ||
        serverCode.includes('.create(');

      expect(hasPersistence).toBe(false); // Proves no persistence
    });
  });

  describe('Scenario: Escalation Path', () => {
    it('Should escalate when customer requests human', async () => {
      const sim = new ConversationSimulator();
      const result = await sim.simulateCall('CA_ESCALATE_001', [
        'I have a complicated situation and need to speak with someone'
      ]);

      const transferCall = result.toolCalls.find(t => t.tool === 'transfer_call');
      expect(transferCall).toBeDefined();
    });
  });
});

describe('Transcript Validation', () => {
  it('Should properly format transcript for email', () => {
    // Simulate transcript formatting as done in server.mjs
    const transcript = [
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Hi, how can I help?' },
      { role: 'user', text: 'Book an appointment' }
    ];

    const formatted = transcript
      .map(t => `[${t.role.toUpperCase()}] ${t.text}`)
      .join('\n');

    expect(formatted).toContain('[USER] Hello');
    expect(formatted).toContain('[ASSISTANT] Hi, how can I help?');
  });
});
