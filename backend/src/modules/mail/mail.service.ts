import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Service } from '../services/entities/service.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';

// turns text from users (names, comments, notes) into safe HTML, so nothing a
// customer types can change how an email looks or add links to it
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private fromEmail: string;
  private fromName: string;
  private appUrl: string;

  constructor(private configService: ConfigService) {
    const port = Number(this.configService.get('MAIL_PORT', 587));
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port,
      // port 465 talks TLS from the start. 587 starts plain and upgrades with
      // STARTTLS, which nodemailer does by itself. MAIL_SECURE=true forces TLS
      secure: this.configService.get<string>('MAIL_SECURE') === 'true' || port === 465,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    this.fromEmail = this.configService.get<string>('MAIL_FROM', 'noreply@servicehub.com');
    this.fromName = this.configService.get<string>('MAIL_FROM_NAME', 'ServiceHub');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  // on the live server, check once at startup that the email login works, so
  // a wrong password shows up in the logs straight away instead of when the
  // first customer asks for a password reset
  async onModuleInit(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') !== 'production') return;
    const host = this.configService.get<string>('MAIL_HOST') || '';
    if (!host || /mailtrap/i.test(host)) {
      this.logger.warn('MAIL_HOST is not a real email provider, so customers will not get any emails');
      return;
    }
    try {
      await this.transporter.verify();
      this.logger.log(`Email is ready (${host})`);
    } catch (error: any) {
      this.logger.error(`Could not sign in to the email server ${host}: ${error?.message || error}`);
    }
  }

  private async sendMail(to: string, subject: string, html: string): Promise<void> {
    // customers who signed up without an email get a made-up @servicehub.local
    // address, which can't receive mail, so don't try
    if (!to || /\.local$/i.test(to)) return;
    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't throw - email failures shouldn't break the main flow
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ServiceHub!</h1>
          </div>
          <div class="content">
            <h2>Hello ${escapeHtml(name)},</h2>
            <p>Thank you for joining ServiceHub! We're excited to have you on board.</p>
            <p>With ServiceHub, you can easily book professional services from verified providers in your area.</p>
            <a href="${this.appUrl}" class="button">Start Browsing Services</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ServiceHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendMail(email, 'Welcome to ServiceHub!', html);
  }

  async sendProviderWelcomeEmail(email: string, providerName: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ServiceHub Provider Network!</h1>
          </div>
          <div class="content">
            <h2>Hello ${escapeHtml(providerName)},</h2>
            <p>Thank you for registering as a service provider on ServiceHub!</p>
            <p>Here's what you can do next:</p>
            <ul>
              <li>Complete your profile to attract more customers</li>
              <li>Add the services you offer</li>
              <li>Set your availability and pricing</li>
            </ul>
            <a href="${this.appUrl}/provider/dashboard" class="button">Go to Dashboard</a>
            <p>Our team will verify your account shortly. You'll receive a notification once verified.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ServiceHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendMail(email, 'Welcome to ServiceHub Provider Network!', html);
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { background: #FEF3C7; padding: 10px; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${escapeHtml(name)},</h2>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <div class="warning">
              <p><strong>Note:</strong> This link will expire in 1 hour.</p>
            </div>
            <p>If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ServiceHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendMail(email, 'Reset Your ServiceHub Password', html);
  }

  // the simple layout every booking email uses
  private bookingEmail(title: string, greetingName: string, lines: string[], booking: Booking): string {
    const service = escapeHtml(booking.serviceName || 'your service');
    const date = booking.date ? escapeHtml(String(booking.date).slice(0, 10)) : '';
    const time = booking.time ? escapeHtml(String(booking.time).slice(0, 5)) : '';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7437F4; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .details { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
          .button { display: inline-block; background: #7437F4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>${escapeHtml(title)}</h1></div>
          <div class="content">
            <h2>Hello ${escapeHtml(greetingName)},</h2>
            ${lines.map((line) => `<p>${line}</p>`).join('')}
            <div class="details">
              <strong>${service}</strong><br>
              ${date}${time ? ` at ${time}` : ''}
            </div>
            <a href="${this.appUrl}" class="button">Open ServiceHub</a>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ServiceHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // sent to the customer when they send a request. booking.customer has to be
  // loaded; without it there is nobody to email
  async sendBookingConfirmation(
    booking: Booking,
    _provider?: ServiceProvider | null,
    _service?: Service | null,
  ): Promise<void> {
    const customer = booking.customer;
    if (!customer?.email) return;
    const html = this.bookingEmail(
      'We received your request',
      customer.name,
      ['Thank you for your request. Our team will assign a provider soon, and we will email you when they do.'],
      booking,
    );
    await this.sendMail(customer.email, 'We received your ServiceHub request', html);
  }

  async sendBookingStatusUpdate(booking: Booking, newStatus: BookingStatus): Promise<void> {
    const statusMessages: Record<BookingStatus, string> = {
      [BookingStatus.PENDING]: 'Your booking is pending confirmation.',
      [BookingStatus.CONFIRMED]: 'Great news! Your booking has been confirmed.',
      [BookingStatus.IN_PROGRESS]: 'Your service is now in progress.',
      [BookingStatus.COMPLETED]: 'Your service has been completed. Please leave a review!',
      [BookingStatus.CANCELLED]: 'Your booking has been cancelled.',
    };
    const subjects: Record<BookingStatus, string> = {
      [BookingStatus.PENDING]: 'Your ServiceHub booking is pending',
      [BookingStatus.CONFIRMED]: 'Your ServiceHub booking is confirmed',
      [BookingStatus.IN_PROGRESS]: 'Your ServiceHub job has started',
      [BookingStatus.COMPLETED]: 'Your ServiceHub job is complete',
      [BookingStatus.CANCELLED]: 'Your ServiceHub booking was cancelled',
    };

    const customer = booking.customer;
    if (!customer?.email) return;

    const lines = [escapeHtml(statusMessages[newStatus])];
    const providerName = booking.providerService?.provider?.providerName;
    if (newStatus === BookingStatus.CONFIRMED && providerName) {
      lines.push(`Your provider is <strong>${escapeHtml(providerName)}</strong>. You can message them from your dashboard.`);
    }
    const html = this.bookingEmail(subjects[newStatus], customer.name, lines, booking);
    await this.sendMail(customer.email, subjects[newStatus], html);
  }

  async sendBookingCancellation(booking: Booking): Promise<void> {
    await this.sendBookingStatusUpdate(booking, BookingStatus.CANCELLED);
  }

  async sendPaymentConfirmation(payment: Payment, booking: Booking): Promise<void> {
    console.log(`Payment confirmation would be sent for payment ${payment.paymentId}`);
  }

  async sendNewReviewNotification(review: Review, provider: ServiceProvider): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .rating { font-size: 24px; color: #F59E0B; }
          .button { display: inline-block; background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Review Received!</h1>
          </div>
          <div class="content">
            <h2>Hello ${escapeHtml(provider.providerName)},</h2>
            <p>You've received a new review from a customer!</p>
            <p class="rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</p>
            ${review.comment ? `<p><em>"${escapeHtml(review.comment)}"</em></p>` : ''}
            <a href="${this.appUrl}/provider/reviews" class="button">View All Reviews</a>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ServiceHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendMail(provider.email, 'You received a new review!', html);
  }

  async sendReviewRequestEmail(email: string, customerName: string, bookingId: string): Promise<void> {
    const reviewUrl = `${this.appUrl}/bookings/${bookingId}/review`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>How was your service?</h1>
          </div>
          <div class="content">
            <h2>Hello ${escapeHtml(customerName)},</h2>
            <p>Your recent service has been completed. We'd love to hear about your experience!</p>
            <p>Your feedback helps other customers make informed decisions and helps providers improve their services.</p>
            <a href="${reviewUrl}" class="button">Leave a Review</a>
            <p>Thank you for using ServiceHub!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ServiceHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendMail(email, 'Share your experience - Leave a review', html);
  }
}
