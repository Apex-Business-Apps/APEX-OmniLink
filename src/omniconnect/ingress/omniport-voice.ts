/**
 * OmniPort Voice Command Handler
 * =============================================================================
 * Seamless voice command integration for OmniPort ingress.
 * Supports natural language voice commands with intent recognition.
 * =============================================================================
 */

import { v4 as uuidv4 } from 'uuid';
import { OmniPort } from './OmniPort';
import { VoiceSource, IngestResult, detectHighRiskIntents } from '../types/ingress';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Voice command configuration
 */
export interface VoiceCommandConfig {
  /** Minimum confidence threshold (0-1) */
  minConfidence: number;

  /** Maximum audio duration in milliseconds */
  maxDurationMs: number;

  /** Enable MAN Mode for all voice commands */
  forceManMode: boolean;

  /** Custom wake words (optional) */
  wakeWords?: string[];
}

/**
 * Voice command result with enhanced metadata
 */
export interface VoiceCommandResult extends IngestResult {
  /** Original transcript */
  transcript: string;

  /** Confidence score */
  confidence: number;

  /** Detected intents */
  detectedIntents: string[];

  /** Was MAN Mode triggered */
  manModeTriggered: boolean;

  /** Processing duration */
  processingMs: number;
}

/**
 * Voice session state
 */
export interface VoiceSession {
  sessionId: string;
  userId: string;
  startedAt: Date;
  lastActivityAt: Date;
  commandCount: number;
  isActive: boolean;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: VoiceCommandConfig = {
  minConfidence: 0.7,
  maxDurationMs: 60000, // 1 minute max
  forceManMode: false,
  wakeWords: ['apex', 'omni', 'hub'],
};

// =============================================================================
// VOICE COMMAND HANDLER
// =============================================================================

/**
 * Voice Command Handler for OmniPort
 * Provides natural language voice command processing
 */
class VoiceCommandHandler {
  private static instance: VoiceCommandHandler | null = null;
  private config: VoiceCommandConfig;
  private sessions: Map<string, VoiceSession> = new Map();

  private constructor(config: Partial<VoiceCommandConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<VoiceCommandConfig>): VoiceCommandHandler {
    if (!VoiceCommandHandler.instance) {
      VoiceCommandHandler.instance = new VoiceCommandHandler(config);
    }
    return VoiceCommandHandler.instance;
  }

  public static resetInstance(): void {
    VoiceCommandHandler.instance = null;
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Process a voice command through OmniPort
   *
   * @param transcript - The voice transcription text
   * @param confidence - Confidence score from speech recognition (0-1)
   * @param audioUrl - URL to the audio recording
   * @param durationMs - Duration of the audio in milliseconds
   * @param userId - Optional user ID (for authenticated commands)
   * @returns Enhanced voice command result
   */
  public async processCommand(
    transcript: string,
    confidence: number,
    audioUrl: string,
    durationMs: number,
    userId?: string
  ): Promise<VoiceCommandResult> {
    const startTime = Date.now();

    // Validate confidence threshold
    if (confidence < this.config.minConfidence) {
      return this.createLowConfidenceResult(transcript, confidence, startTime);
    }

    // Validate duration
    if (durationMs > this.config.maxDurationMs) {
      return this.createDurationExceededResult(transcript, confidence, startTime);
    }

    // Check for wake words if configured
    if (this.config.wakeWords && this.config.wakeWords.length > 0) {
      const hasWakeWord = this.checkWakeWords(transcript);
      if (!hasWakeWord) {
        return this.createNoWakeWordResult(transcript, confidence, startTime);
      }
    }

    // Build VoiceSource input
    const voiceInput: VoiceSource = {
      type: 'voice',
      transcript: this.normalizeTranscript(transcript),
      confidence,
      audioUrl,
      durationMs,
      userId,
    };

    // Process through OmniPort
    const result = await OmniPort.ingest(voiceInput);

    // Detect intents for response
    const detectedIntents = detectHighRiskIntents(transcript);
    const manModeTriggered = detectedIntents.length > 0 || this.config.forceManMode;

    const processingMs = Date.now() - startTime;

    // Update session if userId provided
    if (userId) {
      this.updateSession(userId);
    }

    return {
      ...result,
      transcript,
      confidence,
      detectedIntents,
      manModeTriggered,
      processingMs,
    };
  }

  /**
   * Start a voice session for a user
   */
  public startSession(userId: string): VoiceSession {
    const session: VoiceSession = {
      sessionId: uuidv4(),
      userId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      commandCount: 0,
      isActive: true,
    };

    this.sessions.set(userId, session);
    console.log(`[OmniPort.Voice] Session started for user ${userId}`);

    return session;
  }

  /**
   * End a voice session
   */
  public endSession(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(userId);
      console.log(`[OmniPort.Voice] Session ended for user ${userId} (${session.commandCount} commands)`);
    }
  }

  /**
   * Get active session for a user
   */
  public getSession(userId: string): VoiceSession | undefined {
    return this.sessions.get(userId);
  }

  /**
   * Configure the voice command handler
   */
  public configure(config: Partial<VoiceCommandConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): VoiceCommandConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================

  /**
   * Quick voice command (minimal parameters)
   * Generates a placeholder audio URL for testing
   */
  public async quickCommand(
    transcript: string,
    userId?: string,
    confidence: number = 0.95
  ): Promise<VoiceCommandResult> {
    const dummyAudioUrl = `https://storage.apex.local/audio/${uuidv4()}.wav`;
    const estimatedDurationMs = Math.max(1000, transcript.split(' ').length * 300);

    return this.processCommand(
      transcript,
      confidence,
      dummyAudioUrl,
      estimatedDurationMs,
      userId
    );
  }

  /**
   * Process voice command from browser MediaRecorder
   */
  public async processFromMediaRecorder(
    audioBlob: Blob,
    transcript: string,
    confidence: number,
    userId?: string
  ): Promise<VoiceCommandResult> {
    // In production, this would upload the blob and get a URL
    const audioUrl = `blob:${URL.createObjectURL(audioBlob)}`;
    const durationMs = await this.estimateDuration(audioBlob);

    return this.processCommand(transcript, confidence, audioUrl, durationMs, userId);
  }

  // ===========================================================================
  // INTERNAL HELPERS
  // ===========================================================================

  private checkWakeWords(transcript: string): boolean {
    const lowerTranscript = transcript.toLowerCase();
    return this.config.wakeWords!.some((word) => lowerTranscript.includes(word.toLowerCase()));
  }

  private normalizeTranscript(transcript: string): string {
    // Remove wake words from the beginning
    let normalized = transcript;
    if (this.config.wakeWords) {
      for (const word of this.config.wakeWords) {
        const regex = new RegExp(`^${word}[,.]?\\s*`, 'i');
        normalized = normalized.replace(regex, '');
      }
    }
    return normalized.trim();
  }

  private updateSession(userId: string): void {
    const session = this.sessions.get(userId);
    if (session && session.isActive) {
      session.lastActivityAt = new Date();
      session.commandCount++;
    }
  }

  private async estimateDuration(blob: Blob): Promise<number> {
    // Estimate based on file size (rough approximation)
    // Assumes ~16kbps audio encoding
    const bytesPerMs = 16 / 8; // 16 kbps = 2 bytes per ms
    return Math.round(blob.size / bytesPerMs);
  }

  private createLowConfidenceResult(
    transcript: string,
    confidence: number,
    startTime: number
  ): VoiceCommandResult {
    return {
      correlationId: uuidv4(),
      status: 'blocked',
      latencyMs: Date.now() - startTime,
      riskLane: 'GREEN',
      transcript,
      confidence,
      detectedIntents: [],
      manModeTriggered: false,
      processingMs: Date.now() - startTime,
    };
  }

  private createDurationExceededResult(
    transcript: string,
    confidence: number,
    startTime: number
  ): VoiceCommandResult {
    return {
      correlationId: uuidv4(),
      status: 'blocked',
      latencyMs: Date.now() - startTime,
      riskLane: 'GREEN',
      transcript,
      confidence,
      detectedIntents: [],
      manModeTriggered: false,
      processingMs: Date.now() - startTime,
    };
  }

  private createNoWakeWordResult(
    transcript: string,
    confidence: number,
    startTime: number
  ): VoiceCommandResult {
    return {
      correlationId: uuidv4(),
      status: 'blocked',
      latencyMs: Date.now() - startTime,
      riskLane: 'GREEN',
      transcript,
      confidence,
      detectedIntents: [],
      manModeTriggered: false,
      processingMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const omniPortVoice = VoiceCommandHandler.getInstance();

/**
 * Process a voice command (convenience function)
 */
export async function processVoiceCommand(
  transcript: string,
  confidence: number,
  audioUrl: string,
  durationMs: number,
  userId?: string
): Promise<VoiceCommandResult> {
  return omniPortVoice.processCommand(transcript, confidence, audioUrl, durationMs, userId);
}

/**
 * Quick voice command for testing
 */
export async function quickVoiceCommand(
  transcript: string,
  userId?: string
): Promise<VoiceCommandResult> {
  return omniPortVoice.quickCommand(transcript, userId);
}

/**
 * Start a voice session
 */
export function startVoiceSession(userId: string): VoiceSession {
  return omniPortVoice.startSession(userId);
}

/**
 * End a voice session
 */
export function endVoiceSession(userId: string): void {
  omniPortVoice.endSession(userId);
}

/**
 * Configure voice handler
 */
export function configureVoiceHandler(config: Partial<VoiceCommandConfig>): void {
  omniPortVoice.configure(config);
}
