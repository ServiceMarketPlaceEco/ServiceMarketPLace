import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServicesService } from '../services.service';
import { MATCH_CONFIG, MatchableService, ServiceMatch, matchTranscript } from './transcript-matcher';

export interface TranscriptMatchResult {
  transcript: string;
  // a short english restatement of what the customer asked for (AI only)
  interpretation: string | null;
  matches: ServiceMatch[];
  // which matcher produced the result, so the UI/QA can tell them apart
  source: 'ai' | 'rules';
}

const SYSTEM_PROMPT = `You match a customer's spoken request to services in a local services marketplace in Rajshahi, Bangladesh.
The request comes from browser speech-to-text, so it may be in English or Bengali, may be informal, and may contain recognition mistakes.
Pick the catalog services that would actually solve the customer's problem, best first. Only use serviceIds from the catalog. Leave out services that do not fit; return an empty list if nothing fits.
Reply with JSON only, shaped exactly like:
{"interpretation": "<what the customer needs, one short English sentence>", "matches": [{"serviceId": "<id>", "confidence": <0..1>, "reason": "<short English reason>"}]}`;

@Injectable()
export class ServiceMatchingService {
  private readonly logger = new Logger(ServiceMatchingService.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(
    private readonly servicesService: ServicesService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async matchTranscript(transcript: string, language?: string): Promise<TranscriptMatchResult> {
    const cleaned = transcript.trim();
    const catalog: MatchableService[] = await this.servicesService.findAll();

    if (this.apiKey && catalog.length) {
      const aiResult = await this.matchWithAi(cleaned, language, catalog);
      if (aiResult) return aiResult;
    }

    return {
      transcript: cleaned,
      interpretation: null,
      matches: matchTranscript(cleaned, catalog),
      source: 'rules',
    };
  }

  // returns null on any failure so the caller falls back to the rule matcher.
  // voice search should never break just because the AI is down.
  private async matchWithAi(
    transcript: string,
    language: string | undefined,
    catalog: MatchableService[],
  ): Promise<TranscriptMatchResult | null> {
    const catalogText = catalog
      .map((s) => `- ${s.serviceId} | ${s.serviceName} | ${s.description || ''}`)
      .join('\n');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Catalog (serviceId | name | description):\n${catalogText}\n\nRecognition language: ${language || 'unknown'}\nCustomer said: ${JSON.stringify(transcript)}`,
            },
          ],
          temperature: 0,
          max_tokens: 400,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(`OpenAI transcript match failed: ${response.status} ${body}`);
        return null;
      }

      const data = await response.json();
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
      const matches = this.validateAiMatches(parsed?.matches, catalog);

      // the model found nothing usable; let the rules have a go instead
      if (!matches.length) return null;

      return {
        transcript,
        interpretation:
          typeof parsed?.interpretation === 'string' ? parsed.interpretation.slice(0, 300) : null,
        matches,
        source: 'ai',
      };
    } catch (error) {
      this.logger.warn(`OpenAI transcript match error: ${(error as Error).message}`);
      return null;
    }
  }

  // never trust model output blindly: drop unknown/duplicate ids, clamp
  // confidence, and cap the list size.
  private validateAiMatches(raw: unknown, catalog: MatchableService[]): ServiceMatch[] {
    if (!Array.isArray(raw)) return [];
    const byId = new Map(catalog.map((s) => [s.serviceId, s]));
    const seen = new Set<string>();
    const matches: ServiceMatch[] = [];

    for (const item of raw) {
      const service = byId.get(item?.serviceId);
      if (!service || seen.has(service.serviceId)) continue;
      seen.add(service.serviceId);

      const confidence = Number(item.confidence);
      matches.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        confidence: Number.isFinite(confidence)
          ? Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100
          : 0.5,
        reason: typeof item.reason === 'string' ? item.reason.slice(0, 200) : 'AI match',
      });
    }

    return matches.slice(0, MATCH_CONFIG.maxResults);
  }
}
