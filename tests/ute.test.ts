import { describe, it, expect } from 'vitest';
import { SemanticTranslator } from '../src/omniconnect/translation/translator';
import { CanonicalEvent } from '../src/omniconnect/types/canonical';

describe('Universal Translation Engine (UTE)', () => {
    const translator = new SemanticTranslator();
    const correlationId = 'test-corr-123';
    const appId = 'test-app';

    it('1. Translation Verification (Success)', async () => {
        const events: CanonicalEvent[] = [{
            eventId: 'evt-1',
            payload: { message: 'Hello World' },
            provider: 'test',
            timestamp: new Date().toISOString(),
            metadata: {}
        }];

        const result = await translator.translate(events, appId, correlationId);

        expect(result[0].payload.message).toBe('[fr-FR] Hello World');
        expect(result[0].metadata.verified).toBe(true);
        expect(result[0].metadata.locale).toBe('fr-FR');
    });

    it('2. Fail-Closed on Verification Failure (Simulated)', async () => {
        // We hack the pseudoDetranslate by passing a value that can't be detranslated cleanly
        // But since our pseudo logic is simple string manipulation, let's simulate a mutation

        // Actually, with the current implementation, it's hard to fail unless we override the method or mock it.
        // Let's create a subclass that intentionally breaks back-translation to test the harness.
        class BrokenTranslator extends SemanticTranslator {
            protected pseudoDetranslate(_text: string, _targetLang: string): string {
                return "Corrupted Text"; // Simulates hallucination/drift
            }
        }

        const brokenTranslator = new BrokenTranslator();
        const events: CanonicalEvent[] = [{
            eventId: 'evt-2',
            payload: { message: 'Critical Info' },
            provider: 'test',
            timestamp: new Date().toISOString(),
            metadata: {}
        }];

        const result = await brokenTranslator.translate(events, appId, correlationId);

        expect(result[0].payload._translation_status).toBe('FAILED');
        expect(result[0].metadata.risk_lane).toBe('RED'); // Must be atomic cut
    });

    it('3. Cross-Lingual Consistency', async () => {
        const events: CanonicalEvent[] = [{
            eventId: 'evt-3',
            payload: { key: 'Concept' },
            provider: 'test',
            timestamp: new Date().toISOString(),
            metadata: {}
        }];

        const result = await translator.translate(events, appId, correlationId);
        expect(result[0].payload.key).toBe('[fr-FR] Concept');
    });
});
