// ai second opinion for the moderation queues
//
// the rule-based detectors (fake-review-detector / fake-account-detector) do
// the actual flagging. this is just the "Screen with AI" button on the admin
// dashboard - the admin can ask openai what it thinks about one flagged review
// or account before they decide. the admin still makes the final call, the ai
// never blocks or removes anything by itself.
//
// shared by both moderation controllers so the openai call only lives in one
// place. same fetch pattern as the chatbot service, and the api key stays on
// the backend so it never ends up in the browser.

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// this is the exact shape AdminDashboard.vue reads:
//   'genuine'    -> "Likely genuine"
//   'suspicious' -> "Likely fake"
//   anything else -> "Could not determine"
export interface AiScreeningResult {
  verdict: 'genuine' | 'suspicious' | 'unsure';
  explanation: string;
}

const RULES = `You help the admin of ServiceHub, a local services marketplace in Rajshahi, Bangladesh, spot fake reviews and fake accounts.
You are given what our rule-based detector found. Give a second opinion.
Reply with JSON only, in this shape: {"verdict": "genuine" | "suspicious" | "unsure", "explanation": "one or two plain sentences"}.
Only use the information given. If there is not enough to decide, use "unsure".`;

@Injectable()
export class AiScreeningService {
  constructor(private readonly config: ConfigService) {}

  async screen(what: 'review' | 'account', details: Record<string, unknown>): Promise<AiScreeningResult> {
    // read the key each call so adding it to .env and restarting is all you need
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('AI screening is not configured yet.');
    }

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
          // forces a json reply so we can actually read the verdict
          response_format: { type: 'json_object' },
          // 0 = same input gives the same answer, which is what we want for a judgement call
          temperature: 0,
          max_tokens: 200,
          messages: [
            { role: 'system', content: RULES },
            { role: 'user', content: `Is this ${what} genuine or suspicious?\n${JSON.stringify(details)}` },
          ],
        }),
      });
    } catch (error) {
      throw new ServiceUnavailableException('Could not reach the AI service. Please try again.');
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('OpenAI screening request failed:', response.status, errorBody);
      throw new ServiceUnavailableException('AI screening is temporarily unavailable.');
    }

    const data = await response.json();
    return this.parse(data?.choices?.[0]?.message?.content);
  }

  // never trust the ai reply blindly - if it isnt the shape we asked for,
  // fall back to "unsure" so the admin just decides manually
  private parse(text: string | undefined): AiScreeningResult {
    try {
      const parsed = JSON.parse(text ?? '');
      const verdict = ['genuine', 'suspicious'].includes(parsed.verdict) ? parsed.verdict : 'unsure';
      return { verdict, explanation: String(parsed.explanation || 'No explanation given.') };
    } catch {
      return { verdict: 'unsure', explanation: 'The AI reply could not be read. Please decide manually.' };
    }
  }
}
