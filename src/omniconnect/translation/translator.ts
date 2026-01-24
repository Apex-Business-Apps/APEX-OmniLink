/**
 * Semantic Translator
 * Translates canonical events to app-specific formats
 */

import { CanonicalEvent } from '../types/canonical';

export interface TranslatedEvent {
  eventId: string;
  correlationId: string;
  appId: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * Semantic translator for app-specific event formats
 * TODO: Implement actual translation logic
 */
export class SemanticTranslator {
  private translators = new Map<string, (event: CanonicalEvent) => TranslatedEvent>();

  // Deterministic "Translation" for validation purposes
  // In production, this would call a local AI model or cached dictionary
  private pseudoTranslate(text: unknown, targetLang: string): string {
    if (typeof text !== 'string') return String(text);
    return `[${targetLang}] ${text}`;
  }

  protected pseudoDetranslate(text: string, targetLang: string): string {
    const prefix = `[${targetLang}] `;
    if (text.startsWith(prefix)) {
      return text.slice(prefix.length);
    }
    return text; // Failure to detranslate
  }

  async translate(
    events: CanonicalEvent[],
    appId: string,
    correlationId: string
  ): Promise<TranslatedEvent[]> {
    console.log(`[${correlationId}] Translating ${events.length} events for app ${appId}`);

    // Simulate target locale retrieval (mock)
    const targetLocale = 'fr-FR';

    return events.map(event => {
      const originalPayload = JSON.stringify(event.payload);

      // 1. Forward Translate
      const translatedPayload: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(event.payload)) {
        translatedPayload[key] = this.pseudoTranslate(val, targetLocale);
      }

      // 2. Verification (Back Translate)
      const backTranslated: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(translatedPayload)) {
        if (typeof val === 'string') {
          backTranslated[key] = this.pseudoDetranslate(val, targetLocale);
        } else {
          backTranslated[key] = val;
        }
      }

      // 3. Equivalence Check
      const backTranslatedStr = JSON.stringify(backTranslated);
      if (originalPayload !== backTranslatedStr) {
        console.error(`[${correlationId}] Translation verification failed for event ${event.eventId}`);
        // FAIL-CLOSED: Tag as failed, do not forward potentially corrupted / hallucinated content
        return {
          eventId: event.eventId,
          correlationId,
          appId,
          payload: { ...event.payload, _translation_status: 'FAILED', _error: 'Verification failed' },
          metadata: { ...event.metadata, risk_lane: 'RED', audit_reason: 'translation_verification_failed' }
        };
      }

      return {
        eventId: event.eventId,
        correlationId,
        appId,
        payload: translatedPayload,
        metadata: { ...event.metadata, locale: targetLocale, verified: true }
      };
    });
  }

  registerTranslator(appId: string, translator: (event: CanonicalEvent) => TranslatedEvent): void {
    this.translators.set(appId, translator);
  }

  unregisterTranslator(appId: string): boolean {
    return this.translators.delete(appId);
  }
}