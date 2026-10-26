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

  // These booking and payment emails are not built yet: they only write a log
  // line. The tests pin that down so it is obvious when real emails are added.
  describe('booking and payment notifications (log only for now)', () => {
    const booking = { bookingId: 'BK-1' } as any;

    it('logs a booking confirmation without sending an email', async () => {
      await service.sendBookingConfirmation(booking, {} as any, {} as any);
      expect(console.log).toHaveBeenCalledWith('Booking confirmation would be sent for booking BK-1');
      expect(sendMail).not.toHaveBeenCalled();
    });

    it.each([
      [BookingStatus.PENDING, 'Your booking is pending confirmation.'],
      [BookingStatus.CONFIRMED, 'Great news! Your booking has been confirmed.'],
      [BookingStatus.IN_PROGRESS, 'Your service is now in progress.'],
      [BookingStatus.COMPLETED, 'Your service has been completed. Please leave a review!'],
      [BookingStatus.CANCELLED, 'Your booking has been cancelled.'],
    ])('logs the right status message for %s', async (status, message) => {
      await service.sendBookingStatusUpdate(booking, status);
      expect(console.log).toHaveBeenCalledWith(`Booking status update: BK-1 - ${message}`);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('logs a cancellation and a payment confirmation', async () => {
      await service.sendBookingCancellation(booking);
      await service.sendPaymentConfirmation({ paymentId: 'PAY-1' } as any, booking);
      expect(console.log).toHaveBeenCalledWith('Booking cancellation email would be sent for booking BK-1');
      expect(console.log).toHaveBeenCalledWith('Payment confirmation would be sent for payment PAY-1');
      expect(sendMail).not.toHaveBeenCalled();
    });
  });
});
