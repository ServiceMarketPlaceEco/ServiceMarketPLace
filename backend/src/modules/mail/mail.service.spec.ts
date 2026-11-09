// Unit tests for MailService.
// nodemailer is mocked, so no real email is ever sent. The tests check who each
// email goes to, its subject, the important content, and that an email failure
// never breaks the action that triggered it (registering, resetting a password...).
// Run with: npm test

const sendMail = jest.fn();
const createTransport = jest.fn(() => ({ sendMail }));
jest.mock('nodemailer', () => ({ createTransport: (...args: any[]) => (createTransport as any)(...args) }));

import { MailService } from './mail.service';
import { BookingStatus } from '../bookings/entities/booking.entity';

const config = (values: Record<string, any> = {}) =>
  ({ get: (key: string, fallback?: any) => (key in values ? values[key] : fallback) }) as any;

const sentEmail = () => sendMail.mock.calls[sendMail.mock.calls.length - 1][0];

describe('MailService', () => {
  let service: MailService;

  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({});
    createTransport.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    service = new MailService(
      config({
        MAIL_HOST: 'smtp.test',
        MAIL_PORT: 587,
        MAIL_USER: 'user',
        MAIL_PASS: 'pass',
        MAIL_FROM: 'hello@servicehub.test',
        MAIL_FROM_NAME: 'ServiceHub Test',
        APP_URL: 'http://localhost:5173',
      }),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('sets up the SMTP connection from the config with short timeouts', () => {
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.test',
        port: 587,
        secure: false,
        auth: { user: 'user', pass: 'pass' },
        connectionTimeout: 5000,
      }),
    );
  });

  it('falls back to default sender details when none are configured', async () => {
    const defaults = new MailService(config({}));
    await defaults.sendWelcomeEmail('a@b.com', 'Amy');
    expect(sentEmail().from).toBe('"ServiceHub" <noreply@servicehub.com>');
    expect(sentEmail().html).toContain('http://localhost:3000');
  });

  it('sends the customer welcome email with their name and a link to the app', async () => {
    await service.sendWelcomeEmail('amy@example.com', 'Amy');

    const email = sentEmail();
    expect(email.from).toBe('"ServiceHub Test" <hello@servicehub.test>');
    expect(email.to).toBe('amy@example.com');
    expect(email.subject).toBe('Welcome to ServiceHub!');
    expect(email.html).toContain('Hello Amy,');
    expect(email.html).toContain('href="http://localhost:5173"');
  });

  it('sends the provider welcome email explaining the verification step', async () => {
    await service.sendProviderWelcomeEmail('pro@example.com', 'Rajshahi Cleaners');

    const email = sentEmail();
    expect(email.to).toBe('pro@example.com');
    expect(email.subject).toBe('Welcome to ServiceHub Provider Network!');
    expect(email.html).toContain('Hello Rajshahi Cleaners,');
    expect(email.html).toContain('Our team will verify your account');
  });

  it('puts the reset token in the password reset link', async () => {
    await service.sendPasswordResetEmail('amy@example.com', 'Amy', 'tok-123');

    const email = sentEmail();
    expect(email.subject).toBe('Reset Your ServiceHub Password');
    expect(email.html).toContain('href="http://localhost:5173/reset-password?token=tok-123"');
    // the app doesn't read the token from the link, so it's also shown as text
    // for the user to paste into the "Forgot password" form
    expect(email.html).toContain('>tok-123</p>');
    expect(email.html).toContain('expire in 1 hour');
  });

  it('emails the provider a new review with matching stars and the comment', async () => {
    await service.sendNewReviewNotification(
      { rating: 4, comment: 'Very tidy work' } as any,
      { providerName: 'Rajshahi Cleaners', email: 'pro@example.com' } as any,
    );

    const email = sentEmail();
    expect(email.to).toBe('pro@example.com');
    expect(email.subject).toBe('You received a new review!');
    expect(email.html).toContain('★★★★☆');
    expect(email.html).toContain('"Very tidy work"');
  });

  it('leaves the comment out of the review email when there is none', async () => {
    await service.sendNewReviewNotification(
      { rating: 5, comment: '' } as any,
      { providerName: 'P', email: 'pro@example.com' } as any,
    );
    expect(sentEmail().html).toContain('★★★★★');
    expect(sentEmail().html).not.toContain('<em>');
  });

  it('asks the customer for a review with a link to that booking', async () => {
    await service.sendReviewRequestEmail('amy@example.com', 'Amy', 'BK-1');

    const email = sentEmail();
    expect(email.subject).toBe('Share your experience - Leave a review');
    expect(email.html).toContain('href="http://localhost:5173/bookings/BK-1/review"');
  });

  it('never throws when sending fails, so the main action still succeeds', async () => {
    sendMail.mockRejectedValue(new Error('SMTP down'));

    await expect(service.sendWelcomeEmail('amy@example.com', 'Amy')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('Error sending email:', expect.any(Error));
  });

  // booking emails go to the customer on the booking
  describe('booking emails', () => {
    const booking = (overrides: any = {}) =>
      ({
        bookingId: 'BK-1',
        serviceName: 'Plumbing',
        date: '2026-11-12',
        time: '10:30:00',
        customer: { name: 'Nusrat', email: 'nusrat@example.com' },
        providerService: { provider: { providerName: 'Karim Uddin' } },
        ...overrides,
      }) as any;

    it('tells the customer their request arrived', async () => {
      await service.sendBookingConfirmation(booking(), null, null);

      expect(sentEmail().to).toBe('nusrat@example.com');
      expect(sentEmail().subject).toBe('We received your ServiceHub request');
      expect(sentEmail().html).toContain('Plumbing');
      expect(sentEmail().html).toContain('2026-11-12 at 10:30');
    });

    it.each([
      [BookingStatus.CONFIRMED, 'Your ServiceHub booking is confirmed', 'Great news! Your booking has been confirmed.'],
      [BookingStatus.IN_PROGRESS, 'Your ServiceHub job has started', 'Your service is now in progress.'],
      [BookingStatus.COMPLETED, 'Your ServiceHub job is complete', 'Your service has been completed. Please leave a review!'],
      [BookingStatus.CANCELLED, 'Your ServiceHub booking was cancelled', 'Your booking has been cancelled.'],
    ])('emails the customer when the booking becomes %s', async (status, subject, message) => {
      await service.sendBookingStatusUpdate(booking(), status);

      expect(sentEmail().subject).toBe(subject);
      expect(sentEmail().html).toContain(message);
    });

    it('names the provider once one is assigned', async () => {
      await service.sendBookingStatusUpdate(booking(), BookingStatus.CONFIRMED);

      expect(sentEmail().html).toContain('<strong>Karim Uddin</strong>');
    });

    it('sends a cancellation as a cancelled status email', async () => {
      await service.sendBookingCancellation(booking());

      expect(sentEmail().subject).toBe('Your ServiceHub booking was cancelled');
    });

    it('skips customers without an email, or with the made-up .local one', async () => {
      await service.sendBookingConfirmation(booking({ customer: undefined }));
      await service.sendBookingStatusUpdate(booking({ customer: { name: 'A', email: 'a.b@servicehub.local' } }), BookingStatus.CONFIRMED);

      expect(sendMail).not.toHaveBeenCalled();
    });

    it('does not let text from users add HTML to an email', async () => {
      await service.sendBookingConfirmation(
        booking({ serviceName: '<a href="http://evil.test">Click</a>', customer: { name: '<b>x</b>', email: 'n@example.com' } }),
      );

      expect(sentEmail().html).not.toContain('<a href="http://evil.test">');
      expect(sentEmail().html).toContain('&lt;a href=&quot;http://evil.test&quot;&gt;');
      expect(sentEmail().html).toContain('Hello &lt;b&gt;x&lt;/b&gt;');
    });

    it('still only logs the payment confirmation (payments are simulated)', async () => {
      await service.sendPaymentConfirmation({ paymentId: 'PAY-1' } as any, booking());

      expect(console.log).toHaveBeenCalledWith('Payment confirmation would be sent for payment PAY-1');
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('real email providers', () => {
    it('uses TLS from the start on port 465', () => {
      createTransport.mockClear();
      new MailService(config({ MAIL_PORT: 465 }));
      expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true }));
    });

    it('can be forced to TLS with MAIL_SECURE=true', () => {
      createTransport.mockClear();
      new MailService(config({ MAIL_SECURE: 'true' }));
      expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
    });

    it('checks the email login at startup on the live server', async () => {
      const verify = jest.fn().mockResolvedValue(true);
      createTransport.mockReturnValueOnce({ sendMail, verify } as any);
      const live = new MailService(config({ NODE_ENV: 'production', MAIL_HOST: 'smtp-relay.brevo.com' }));
      jest.spyOn((live as any).logger, 'log').mockImplementation(() => undefined);

      await live.onModuleInit();

      expect(verify).toHaveBeenCalled();
    });

    it('warns at startup when the live server still uses Mailtrap', async () => {
      const verify = jest.fn();
      createTransport.mockReturnValueOnce({ sendMail, verify } as any);
      const live = new MailService(config({ NODE_ENV: 'production', MAIL_HOST: 'smtp.mailtrap.io' }));
      const warn = jest.spyOn((live as any).logger, 'warn').mockImplementation(() => undefined);

      await live.onModuleInit();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('not a real email provider'));
      expect(verify).not.toHaveBeenCalled();
    });

    it('does not check anything on a laptop', async () => {
      const verify = jest.fn();
      createTransport.mockReturnValueOnce({ sendMail, verify } as any);
      const local = new MailService(config({ NODE_ENV: 'development' }));

      await local.onModuleInit();

      expect(verify).not.toHaveBeenCalled();
    });
  });
});
