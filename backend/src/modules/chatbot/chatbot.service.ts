import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatMessageDto } from './dto';

const SYSTEM_PROMPT = `You are the ServiceHub assistant, embedded in a local services marketplace app for Rajshahi (cleaning, tutoring, delivery, tech support, AC repair, electrician, plumbing, moving help, elder care).

Help visitors with:
- Browsing and booking services
- How provider registration and admin approval works
- Tracking a booking's status
- Signing in (customers sign in with name/phone, providers with their provider ID)
- General navigation of the app

Keep answers short (2-4 sentences), friendly, and specific to ServiceHub. You do not have access to any specific user's account, bookings, or personal data — if asked about a specific booking or account, tell the user to check their dashboard instead of guessing. If you don't know something, say so honestly rather than making it up.`;

@Injectable()
export class ChatbotService {
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async getReply(message: string, history: ChatMessageDto[] = []): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('AI assistant is not configured yet.');
    }

    const recentHistory = history.slice(-10);

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...recentHistory.map((turn) => ({ role: turn.role, content: turn.content })),
            { role: 'user', content: message },
          ],
          temperature: 0.4,
          max_tokens: 300,
        }),
      });
    } catch (error) {
      throw new ServiceUnavailableException('Could not reach the AI assistant. Please try again.');
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('OpenAI chatbot request failed:', response.status, errorBody);
      throw new ServiceUnavailableException('The AI assistant is temporarily unavailable.');
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    return reply || "Sorry, I couldn't come up with an answer just now. Please try rephrasing your question.";
  }
}
