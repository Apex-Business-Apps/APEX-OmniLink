/**
 * Mock Twilio Client for Testing
 * Simulates Twilio's media stream WebSocket behavior
 */

import { EventEmitter } from 'events';

export class MockTwilioMediaStream extends EventEmitter {
  constructor(callSid = 'CA_MOCK_' + Date.now()) {
    super();
    this.callSid = callSid;
    this.streamSid = 'MZ_MOCK_' + Date.now();
    this.connected = false;
    this.messageHistory = [];
    this.audioChunks = [];
  }

  /**
   * Simulate connection establishment
   */
  connect() {
    this.connected = true;

    // Send 'start' event like real Twilio
    setTimeout(() => {
      this.emit('message', JSON.stringify({
        event: 'start',
        sequenceNumber: '1',
        start: {
          streamSid: this.streamSid,
          callSid: this.callSid,
          accountSid: 'AC_MOCK_ACCOUNT',
          tracks: ['inbound'],
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1
          }
        }
      }));
    }, 50);
  }

  /**
   * Send mock audio payload (simulating caller speaking)
   * @param {string} base64Audio - Base64 encoded G711 ulaw audio
   */
  sendAudio(base64Audio) {
    if (!this.connected) {
      throw new Error('Stream not connected');
    }

    const message = {
      event: 'media',
      sequenceNumber: String(this.audioChunks.length + 2),
      media: {
        track: 'inbound',
        chunk: String(this.audioChunks.length),
        timestamp: String(Date.now()),
        payload: base64Audio
      }
    };

    this.audioChunks.push(base64Audio);
    this.messageHistory.push(message);
    this.emit('message', JSON.stringify(message));
  }

  /**
   * Simulate call ending
   */
  stop() {
    if (!this.connected) return;

    this.emit('message', JSON.stringify({
      event: 'stop',
      sequenceNumber: String(this.audioChunks.length + 3),
      stop: {
        accountSid: 'AC_MOCK_ACCOUNT',
        callSid: this.callSid
      }
    }));

    this.connected = false;
    this.emit('close');
  }

  /**
   * Handle incoming message from server
   */
  receiveFromServer(message) {
    try {
      const parsed = JSON.parse(message);
      this.messageHistory.push({ direction: 'from_server', ...parsed });

      if (parsed.event === 'media' && parsed.media?.payload) {
        // Server is sending audio back (AI response)
        this.emit('audio_response', parsed.media.payload);
      }
    } catch (e) {
      console.error('Failed to parse server message:', e);
    }
  }

  /**
   * Get transcript of all messages
   */
  getMessageHistory() {
    return this.messageHistory;
  }
}

/**
 * Mock Twilio REST Client for call operations
 */
export class MockTwilioRestClient {
  constructor() {
    this.callOperations = [];
  }

  calls(callSid) {
    return {
      update: async (options) => {
        this.callOperations.push({ callSid, operation: 'update', options });
        return { sid: callSid, status: 'updated' };
      },
      fetch: async () => {
        return { sid: callSid, status: 'in-progress' };
      }
    };
  }

  getOperationHistory() {
    return this.callOperations;
  }
}

/**
 * Generate mock G711 ulaw audio for testing
 * This creates a simple tone pattern
 */
export function generateMockAudio(durationMs = 100) {
  const sampleRate = 8000;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples);

  // Generate a simple pattern (not actual audio, just for testing)
  for (let i = 0; i < numSamples; i++) {
    // Create a simple wave pattern encoded as G711 ulaw
    buffer[i] = Math.floor(127 + 127 * Math.sin(i * 0.1));
  }

  return buffer.toString('base64');
}

export default {
  MockTwilioMediaStream,
  MockTwilioRestClient,
  generateMockAudio
};
