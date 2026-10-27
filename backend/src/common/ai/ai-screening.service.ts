// ai second opinion for the moderation queues, using claude
//
// the rule-based detectors (fake-review-detector / fake-account-detector) do
// the actual flagging. this is just the "Screen with AI" button on the admin
// dashboard - the admin can ask claude what it thinks about one flagged review
// or account before they decide. the admin still makes the final call, the ai
// never blocks or removes anything by itself.
//
// this used to live in the frontend (api.js called api.anthropic.com straight
// from the browser), but that meant the api key would have to sit in the
// browser where anyone could read it. so it moved here and the frontend just
// calls /reviews/moderation/ai-screen and /providers/moderation/ai-screen.
// shared by both moderation controllers so the claude call only lives in one place.

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
Respond with ONLY a JSON object (no markdown, no backticks), in this shape:
{"verdict": "genuine" | "suspicious" | "unsure", "explanation": "one or two plain sentences"}
Only use the information given. If there is not enough to decide, use "unsure".`;

@Injectable()
export class AiScreeningService {
  constructor(private readonly config: ConfigService) {}

  async screen(what: 'review' | 'account', details: Record<string, unknown>): Promise<AiScreeningResult> {
    // read the key each call so adding it to .env and restarting is all you need
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('AI screening is not configured yet.');
    }

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // claude needs both of these. the old browser version sent neither,
          // which is one reason it never worked
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-5-5'),
          max_tokens: 200,
          // 0 = same input gives the same answer, which is what we want for a judgement call
          temperature: 0,
          system: RULES,
          messages: [{ role: 'user', content: `Is this ${what} genuine or suspicious?\n${JSON.stringify(details)}` }],
        }),
      });
    } catch (error) {
      throw new ServiceUnavailableException('Could not reach the AI service. Please try again.');
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('Claude screening request failed:', response.status, errorBody);
      throw new ServiceUnavailableException('AI screening is temporarily unavailable.');
    }

    const data = await response.json();
    // claude replies with a list of content blocks, the text is in the first one
    return this.parse(data?.content?.[0]?.text);
  }

  // never trust the ai reply blindly - if it isnt the shape we asked for,
  // fall back to "unsure" so the admin just decides manually
  private parse(text: string | undefined): AiScreeningResult {
    try {
      // sometimes it still wraps the json in ```json ... ``` so strip that first
      const clean = (text ?? '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const verdict = ['genuine', 'suspicious'].includes(parsed.verdict) ? parsed.verdict : 'unsure';
      return { verdict, explanation: String(parsed.explanation || 'No explanation given.') };
    } catch {
      return { verdict: 'unsure', explanation: 'The AI reply could not be read. Please decide manually.' };
    }
  }
}
