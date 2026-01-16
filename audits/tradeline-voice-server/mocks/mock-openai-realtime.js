/**
 * Mock OpenAI Realtime API Server
 * Simulates OpenAI's WebSocket-based Realtime API for testing
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class MockOpenAIRealtimeServer extends EventEmitter {
  constructor(port = 9999) {
    super();
    this.port = port;
    this.wss = null;
    this.connections = [];
    this.messageLog = [];
    this.sessionConfig = null;
    this.responseMode = 'normal'; // 'normal', 'tool_call', 'error'
    this.toolCallQueue = [];
  }

  /**
   * Start the mock server
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('listening', () => {
        console.log(`[MockOpenAI] Server listening on port ${this.port}`);
        resolve();
      });

      this.wss.on('error', reject);

      this.wss.on('connection', (ws) => {
        this.connections.push(ws);
        console.log('[MockOpenAI] Client connected');

        ws.on('message', (data) => {
          this.handleMessage(ws, data);
        });

        ws.on('close', () => {
          this.connections = this.connections.filter(c => c !== ws);
          console.log('[MockOpenAI] Client disconnected');
        });
      });
    });
  }

  /**
   * Handle incoming message from client
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      this.messageLog.push({ direction: 'incoming', ...message });
      this.emit('message', message);

      switch (message.type) {
        case 'session.update':
          this.handleSessionUpdate(ws, message);
          break;

        case 'input_audio_buffer.append':
          this.handleAudioInput(ws, message);
          break;

        case 'conversation.item.create':
          this.handleConversationItem(ws, message);
          break;

        case 'response.create':
          this.handleResponseCreate(ws, message);
          break;

        default:
          console.log(`[MockOpenAI] Unhandled message type: ${message.type}`);
      }
    } catch (e) {
      console.error('[MockOpenAI] Error handling message:', e);
    }
  }

  /**
   * Handle session.update
   */
  handleSessionUpdate(ws, message) {
    this.sessionConfig = message.session;

    // Confirm session update
    this.send(ws, {
      type: 'session.updated',
      session: {
        id: 'sess_mock_' + Date.now(),
        ...message.session
      }
    });
  }

  /**
   * Handle audio input
   */
  handleAudioInput(ws, message) {
    // Acknowledge audio received (in real API this triggers VAD)
    this.emit('audio_received', message.audio);

    // If enough audio accumulated, simulate user speech detection
    if (this.responseMode === 'normal' && Math.random() > 0.7) {
      this.simulateUserTranscript(ws, 'Hello, I would like to book an appointment.');
    }
  }

  /**
   * Simulate user speech transcription
   */
  simulateUserTranscript(ws, text) {
    this.send(ws, {
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: text,
      item_id: 'item_' + Date.now()
    });
  }

  /**
   * Handle conversation item (tool results)
   */
  handleConversationItem(ws, message) {
    if (message.item?.type === 'function_call_output') {
      // Tool response received, now generate AI response
      this.emit('tool_response_received', message.item);
    }
  }

  /**
   * Handle response.create - generate AI response
   */
  handleResponseCreate(ws, message) {
    // Check if we should trigger a tool call
    if (this.toolCallQueue.length > 0) {
      const toolCall = this.toolCallQueue.shift();
      this.sendToolCall(ws, toolCall);
      return;
    }

    // Normal response - send audio and transcript
    this.sendAIResponse(ws, 'Thank you for calling TradeLine 24/7. How can I help you today?');
  }

  /**
   * Send AI audio response
   */
  sendAIResponse(ws, text) {
    // Send audio delta (mock base64 audio)
    const mockAudioChunks = 5;
    for (let i = 0; i < mockAudioChunks; i++) {
      this.send(ws, {
        type: 'response.audio.delta',
        delta: Buffer.from(`mock_audio_chunk_${i}`).toString('base64'),
        response_id: 'resp_' + Date.now(),
        item_id: 'item_' + Date.now()
      });
    }

    // Send transcript done
    this.send(ws, {
      type: 'response.audio_transcript.done',
      transcript: text,
      response_id: 'resp_' + Date.now(),
      item_id: 'item_' + Date.now()
    });
  }

  /**
   * Queue a tool call to be triggered
   */
  queueToolCall(name, args) {
    this.toolCallQueue.push({ name, args });
  }

  /**
   * Send tool call to client
   */
  sendToolCall(ws, toolCall) {
    this.send(ws, {
      type: 'response.function_call_arguments.done',
      call_id: 'call_' + Date.now(),
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.args)
    });
  }

  /**
   * Send message to client
   */
  send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      this.messageLog.push({ direction: 'outgoing', ...data });
      ws.send(message);
    }
  }

  /**
   * Get all logged messages
   */
  getMessageLog() {
    return this.messageLog;
  }

  /**
   * Get session configuration
   */
  getSessionConfig() {
    return this.sessionConfig;
  }

  /**
   * Stop the mock server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        this.connections.forEach(ws => ws.close());
        this.wss.close(() => {
          console.log('[MockOpenAI] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default MockOpenAIRealtimeServer;
