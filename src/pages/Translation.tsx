import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Languages, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SemanticTranslator } from '@/omniconnect/translation/translator';
import { CanonicalEvent } from '@/omniconnect/types/canonical';
import { ThemeToggle } from '@/components/ThemeToggle';

const LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
];

/**
 * Translation Page - User-facing translation UI
 * Uses existing SemanticTranslator engine (client-side)
 * Read-only, no external API calls
 */
export default function Translation() {
  const [inputJson, setInputJson] = useState('');
  const [targetLocale, setTargetLocale] = useState('fr-FR');
  const [translatedResult, setTranslatedResult] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleTranslate = async () => {
    try {
      // Parse input JSON
      const parsed = JSON.parse(inputJson);

      // Convert to CanonicalEvent format
      const event: CanonicalEvent = {
        eventId: crypto.randomUUID(),
        eventType: parsed.eventType || 'custom',
        timestamp: new Date().toISOString(),
        source: parsed.source || 'omnilink-ui',
        payload: parsed.payload || parsed,
        metadata: parsed.metadata || {},
      };

      // Create translator instance
      const translator = new SemanticTranslator();

      // Translate (client-side, deterministic)
      const result = await translator.translate([event], 'omnilink-ui', crypto.randomUUID());

      // Check translation status
      const translatedEvent = result[0];
      if (translatedEvent.metadata.risk_lane === 'RED') {
        setStatus('error');
        setErrorMessage(
          translatedEvent.payload._error as string || 'Translation verification failed'
        );
        setTranslatedResult(JSON.stringify(translatedEvent, null, 2));
      } else {
        setStatus('success');
        setTranslatedResult(JSON.stringify(translatedEvent, null, 2));
        toast.success('Translation complete with verification');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Invalid JSON');
      toast.error('Translation failed');
    }
  };

  const handleClear = () => {
    setInputJson('');
    setTranslatedResult('');
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Translation</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5" />
              Semantic Translation
            </CardTitle>
            <CardDescription>
              Translate event payloads with automatic verification (preview mode)
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="locale">Target Locale</Label>
              <Select value={targetLocale} onValueChange={setTargetLocale}>
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((locale) => (
                    <SelectItem key={locale.value} value={locale.value}>
                      {locale.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="input">JSON Payload</Label>
              <Textarea
                id="input"
                placeholder='{"eventType": "message.sent", "payload": {"text": "Hello world"}}'
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleTranslate} disabled={!inputJson}>
                Translate
              </Button>
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result Section */}
        {translatedResult && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Result</CardTitle>
                {status === 'success' && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </Badge>
                )}
                {status === 'error' && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    Failed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === 'error' && errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>Translated Event</Label>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-[400px] overflow-y-auto">
                    {translatedResult}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      navigator.clipboard.writeText(translatedResult);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Notice */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Preview Mode</p>
                <p className="text-xs">
                  This is a deterministic preview using pseudo-translation. Production
                  translation would use local AI models or cached dictionaries with full
                  semantic equivalence verification.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
