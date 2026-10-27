// Unit tests for ChatbotService (the AI assistant behind the "AI Help" button).
// The real OpenAI call is replaced by a mocked global fetch, so these tests are
// free, fast and never need an API key or the internet.
// Run with: npm test

import { ServiceUnavailableException } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

// ConfigService stand-in: returns the values given, otherwise the fallback.
const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string, fallback?: any) => (key in values ? values[key] : fallback) }) as any;

const okResponse = (body: any) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const reply = (content: any) => okResponse({ choices: [{ message: { content } }] });

describe('ChatbotService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const service = (values: Record<string, string | undefined> = { OPENAI_API_KEY: 'test-key' }) =>
    new ChatbotService(config(values));

  it('refuses politely when no OpenAI key is configured, without calling OpenAI', async () => {
    await expect(service({}).getReply('Hello')).rejects.toThrow(
      new ServiceUnavailableException('AI assistant is not configured yet.'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the trimmed reply from OpenAI', async () => {
    fetchMock.mockResolvedValue(reply('  Open Services and choose Home Cleaning.  '));

    expect(await service().getReply('How do I book?')).toBe('Open Services and choose Home Cleaning.');
  });

  it('sends the system prompt, the history and the new question in that order', async () => {
    fetchMock.mockResolvedValue(reply('ok'));
    const history = [
      { role: 'user' as const, content: 'Hi' },
      { role: 'assistant' as const, content: 'Hello! How can I help?' },
    ];

    await service().getReply('How do I track my booking?', history);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('ServiceHub assistant');
    expect(body.messages.slice(1)).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello! How can I help?' },
      { role: 'user', content: 'How do I track my booking?' },
    ]);
  });

  it('keeps answers short and focused (low temperature, token cap)', async () => {
    fetchMock.mockResolvedValue(reply('ok'));

    await service().getReply('Hi');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.4);
    expect(body.max_tokens).toBe(300);
  });

  it('uses gpt-4o-mini by default and the configured model when one is set', async () => {
    fetchMock.mockResolvedValue(reply('ok'));

    await service().getReply('Hi');
    await service({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'gpt-4.1-mini' }).getReply('Hi');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('gpt-4o-mini');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe('gpt-4.1-mini');
  });

  it('only sends the last 10 turns of history so requests stay small', async () => {
    fetchMock.mockResolvedValue(reply('ok'));
    const history = Array.from({ length: 15 }, (_, i) => ({ role: 'user' as const, content: `turn ${i}` }));

    await service().getReply('latest', history);

    const messages = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    // 1 system + 10 history + 1 new question
    expect(messages).toHaveLength(12);
    expect(messages[1].content).toBe('turn 5');
    expect(messages[10].content).toBe('turn 14');
  });

  it('reports the assistant as unreachable when the network call fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(service().getReply('Hi')).rejects.toThrow('Could not reach the AI assistant. Please try again.');
  });

  it('reports the assistant as unavailable when OpenAI returns an error, and logs it', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });

    await expect(service().getReply('Hi')).rejects.toThrow('The AI assistant is temporarily unavailable.');
    expect(console.error).toHaveBeenCalledWith('OpenAI chatbot request failed:', 429, 'rate limited');
  });

  it('still reports unavailable if the error body cannot be read', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => { throw new Error('stream closed'); } });

    await expect(service().getReply('Hi')).rejects.toThrow(ServiceUnavailableException);
    expect(console.error).toHaveBeenCalledWith('OpenAI chatbot request failed:', 500, '');
  });

  it.each([
    ['an empty reply', { choices: [{ message: { content: '   ' } }] }],
    ['no choices at all', { choices: [] }],
    ['an unexpected response shape', {}],
  ])('falls back to a friendly message for %s', async (_case, body) => {
    fetchMock.mockResolvedValue(okResponse(body));

    expect(await service().getReply('Hi')).toBe(
      "Sorry, I couldn't come up with an answer just now. Please try rephrasing your question.",
    );
  });
});
