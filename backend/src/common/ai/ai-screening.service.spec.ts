// Unit tests for AiScreeningService (the "Screen with AI" second opinion).
// fetch is mocked so these never call claude for real and dont need a key.
// Run with: npm test

import { ServiceUnavailableException } from '@nestjs/common';
import { AiScreeningService } from './ai-screening.service';

// a tiny stand in for ConfigService. pass a key to pretend its set in .env
const config = (apiKey?: string) =>
  ({ get: (key: string, fallback?: any) => (key === 'ANTHROPIC_API_KEY' ? apiKey : fallback) }) as any;

// pretend claude replied with this text
const aiReplies = (content: string) => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: content }] }),
  })) as any;
};

describe('AiScreeningService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('says its not set up when there is no api key, without calling claude', async () => {
    global.fetch = jest.fn() as any;

    await expect(new AiScreeningService(config()).screen('review', {})).rejects.toThrow(
      new ServiceUnavailableException('AI screening is not configured yet.'),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns the verdict and explanation the ai gave', async () => {
    aiReplies('{"verdict":"suspicious","explanation":"Generic five star text from a brand new account."}');

    const result = await new AiScreeningService(config('test-key')).screen('review', { rating: 5 });

    expect(result).toEqual({ verdict: 'suspicious', explanation: 'Generic five star text from a brand new account.' });
  });

  it('calls claude with the key and version headers and the details we passed in', async () => {
    aiReplies('{"verdict":"genuine","explanation":"Detailed comment."}');

    await new AiScreeningService(config('test-key')).screen('account', { kind: 'provider', detectorScore: 4 });

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('test-key');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.temperature).toBe(0);
    expect(body.system).toContain('ServiceHub');
    expect(body.messages[0].content).toContain('Is this account genuine or suspicious?');
    expect(body.messages[0].content).toContain('"detectorScore":4');
  });

  it('uses the model from ANTHROPIC_MODEL when its set', async () => {
    aiReplies('{"verdict":"genuine","explanation":"ok"}');
    const withModel = { get: (key: string) => ({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-haiku-5-5' } as any)[key] } as any;

    await new AiScreeningService(withModel).screen('review', {});

    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).model).toBe('claude-haiku-5-5');
  });

  it('still reads the reply when claude wraps the json in backticks', async () => {
    aiReplies('```json\n{"verdict":"suspicious","explanation":"Copied text."}\n```');

    const result = await new AiScreeningService(config('test-key')).screen('review', {});

    expect(result).toEqual({ verdict: 'suspicious', explanation: 'Copied text.' });
  });

  it('falls back to unsure when the ai makes up its own verdict', async () => {
    aiReplies('{"verdict":"probably fake","explanation":"hmm"}');

    const result = await new AiScreeningService(config('test-key')).screen('review', {});

    expect(result).toEqual({ verdict: 'unsure', explanation: 'hmm' });
  });

  it('falls back to unsure when the reply isnt json at all', async () => {
    aiReplies('I think this one is fake');

    const result = await new AiScreeningService(config('test-key')).screen('account', {});

    expect(result.verdict).toBe('unsure');
    expect(result.explanation).toBe('The AI reply could not be read. Please decide manually.');
  });

  it('fills in an explanation when the ai leaves it out', async () => {
    aiReplies('{"verdict":"genuine"}');

    const result = await new AiScreeningService(config('test-key')).screen('review', {});

    expect(result).toEqual({ verdict: 'genuine', explanation: 'No explanation given.' });
  });

  it('reports claude being down as unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, text: async () => 'server error' })) as any;

    await expect(new AiScreeningService(config('test-key')).screen('review', {})).rejects.toThrow(
      'AI screening is temporarily unavailable.',
    );
  });

  it('reports no internet as unavailable', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as any;

    await expect(new AiScreeningService(config('test-key')).screen('review', {})).rejects.toThrow(
      'Could not reach the AI service. Please try again.',
    );
  });
});
