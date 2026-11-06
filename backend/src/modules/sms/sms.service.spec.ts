import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

const makeService = (env: Record<string, string>) =>
  new SmsService({
    get: (key: string, fallback?: string) => env[key] ?? fallback,
  } as unknown as ConfigService);

const twilio = {
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_AUTH_TOKEN: 'token',
  TWILIO_FROM: '+15005550006',
};

describe('SmsService', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('is only switched on when all three Twilio settings are set', () => {
    expect(makeService({}).isConfigured()).toBe(false);
    expect(makeService({ TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'token' }).isConfigured()).toBe(false);
    expect(makeService(twilio).isConfigured()).toBe(true);
  });

  it('turns local numbers into international ones', () => {
    const bd = makeService({});
    expect(bd.toInternational('01712345678')).toBe('+8801712345678');
    expect(bd.toInternational('017-1234 5678')).toBe('+8801712345678');
    expect(bd.toInternational('+61 412 345 678')).toBe('+61412345678');
    expect(bd.toInternational('0061412345678')).toBe('+61412345678');

    const au = makeService({ SMS_DEFAULT_COUNTRY_CODE: '+61' });
    expect(au.toInternational('0412345678')).toBe('+61412345678');
  });

  it('refuses to send when Twilio is not set up', async () => {
    await expect(makeService({}).send('01712345678', 'hi')).rejects.toThrow('not configured');
  });

  it('posts the message to Twilio with the account login', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await makeService(twilio).send('01712345678', 'Your code is 123456');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('AC123:token').toString('base64')}`);
    const body = options.body as URLSearchParams;
    expect(body.get('To')).toBe('+8801712345678');
    expect(body.get('From')).toBe('+15005550006');
    expect(body.get('Body')).toBe('Your code is 123456');
  });

  it('throws when Twilio rejects the message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"message":"The number is unverified"}',
    }) as unknown as typeof fetch;
    const service = makeService(twilio);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

    await expect(service.send('01712345678', 'hi')).rejects.toThrow('status 400');
  });
});
