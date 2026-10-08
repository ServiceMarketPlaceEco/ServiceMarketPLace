// unit tests for ServiceMatchingService - the AI first, rules fallback wrapper
// fetch is mocked, nothing hits openai.
//
// run with: npm test

import { ServiceMatchingService } from './service-matching.service';

const CATALOG = [
  { serviceId: 'ac', serviceName: 'AC Repair', description: 'AC servicing, cooling issue checks and installation help.' },
  { serviceId: 'plumbing', serviceName: 'Plumbing Help', description: 'Tap leaks, pipe issues, bathroom fittings and drainage help.' },
];

function build(apiKey?: string) {
  const servicesService = { findAll: jest.fn().mockResolvedValue(CATALOG) } as any;
  const configService = {
    get: jest.fn((key: string, fallback?: string) => (key === 'OPENAI_API_KEY' ? apiKey : fallback)),
  } as any;
  return new ServiceMatchingService(servicesService, configService);
}

function openAiReplies(content: unknown) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  } as any);
}

describe('ServiceMatchingService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the rule matcher when no OpenAI key is configured', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await build(undefined).matchTranscript('  my tap is leaking ');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.source).toBe('rules');
    expect(result.transcript).toBe('my tap is leaking');
    expect(result.matches[0].serviceId).toBe('plumbing');
  });

  it('returns validated AI matches when the model answers', async () => {
    openAiReplies({
      interpretation: 'The customer needs their air conditioner fixed.',
      matches: [
        { serviceId: 'ac', confidence: 1.7, reason: 'Cooling problem' },
        { serviceId: 'made-up-id', confidence: 0.9, reason: 'hallucinated' },
        { serviceId: 'ac', confidence: 0.4, reason: 'duplicate' },
      ],
    });

    const result = await build('sk-test').matchTranscript('aircon is blowing warm', 'en-AU');

    expect(result.source).toBe('ai');
    expect(result.interpretation).toMatch(/air conditioner/);
    expect(result.matches).toEqual([
      { serviceId: 'ac', serviceName: 'AC Repair', confidence: 1, reason: 'Cooling problem' },
    ]);
  });

  it('falls back to rules when the AI call fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
    const result = await build('sk-test').matchTranscript('the pipe under the sink leaks');

    expect(result.source).toBe('rules');
    expect(result.matches[0].serviceId).toBe('plumbing');
  });

  it('falls back to rules when the AI returns no usable ids', async () => {
    openAiReplies({ interpretation: 'x', matches: [{ serviceId: 'nope' }] });
    const result = await build('sk-test').matchTranscript('my tap is leaking');

    expect(result.source).toBe('rules');
    expect(result.matches[0].serviceId).toBe('plumbing');
  });
});
