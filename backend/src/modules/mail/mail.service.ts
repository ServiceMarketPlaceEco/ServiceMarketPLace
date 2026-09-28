import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Service } from '../services/entities/service.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;
  private fromName: string;
  private appUrl: string;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: false,
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

  private async sendMail(to: string, subject: string, html: string): Promise<void> {
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
            <h2>Hello ${name},</h2>
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
            <h2>Hello ${providerName},</h2>
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
            <h2>Hello ${name},</h2>
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

  async sendBookingConfirmation(
    booking: Booking,
    provider: ServiceProvider,
    service: Service,
  ): Promise<void> {
    // This would need customer email from the booking
    // For now, we'll just log it
    console.log(`Booking confirmation would be sent for booking ${booking.bookingId}`);
  }

  async sendBookingStatusUpdate(booking: Booking, newStatus: BookingStatus): Promise<void> {
    const statusMessages: Record<BookingStatus, string> = {
      [BookingStatus.PENDING]: 'Your booking is pending confirmation.',
      [BookingStatus.CONFIRMED]: 'Great news! Your booking has been confirmed.',
      [BookingStatus.IN_PROGRESS]: 'Your service is now in progress.',
      [BookingStatus.COMPLETED]: 'Your service has been completed. Please leave a review!',
      [BookingStatus.CANCELLED]: 'Your booking has been cancelled.',
    };

    console.log(`Booking status update: ${booking.bookingId} - ${statusMessages[newStatus]}`);
  }

  async sendBookingCancellation(booking: Booking): Promise<void> {
    console.log(`Booking cancellation email would be sent for booking ${booking.bookingId}`);
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
            <h2>Hello ${provider.providerName},</h2>
            <p>You've received a new review from a customer!</p>
            <p class="rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</p>
            ${review.comment ? `<p><em>"${review.comment}"</em></p>` : ''}
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
            <h2>Hello ${customerName},</h2>
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
