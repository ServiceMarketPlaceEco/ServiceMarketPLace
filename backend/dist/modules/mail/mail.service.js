"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = require("nodemailer");
const booking_entity_1 = require("../bookings/entities/booking.entity");
let MailService = class MailService {
    constructor(configService) {
        this.configService = configService;
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('MAIL_HOST'),
            port: this.configService.get('MAIL_PORT'),
            secure: false,
            auth: {
                user: this.configService.get('MAIL_USER'),
                pass: this.configService.get('MAIL_PASS'),
            },
        });
        this.fromEmail = this.configService.get('MAIL_FROM', 'noreply@servicehub.com');
        this.fromName = this.configService.get('MAIL_FROM_NAME', 'ServiceHub');
        this.appUrl = this.configService.get('APP_URL', 'http://localhost:3000');
    }
    async sendMail(to, subject, html) {
        try {
            await this.transporter.sendMail({
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to,
                subject,
                html,
            });
        }
        catch (error) {
            console.error('Error sending email:', error);
        }
    }
    async sendWelcomeEmail(email, name) {
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
    async sendProviderWelcomeEmail(email, providerName) {
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
    async sendPasswordResetEmail(email, name, resetToken) {
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
    async sendBookingConfirmation(booking, provider, service) {
        console.log(`Booking confirmation would be sent for booking ${booking.bookingId}`);
    }
    async sendBookingStatusUpdate(booking, newStatus) {
        const statusMessages = {
            [booking_entity_1.BookingStatus.PENDING]: 'Your booking is pending confirmation.',
            [booking_entity_1.BookingStatus.CONFIRMED]: 'Great news! Your booking has been confirmed.',
            [booking_entity_1.BookingStatus.IN_PROGRESS]: 'Your service is now in progress.',
            [booking_entity_1.BookingStatus.COMPLETED]: 'Your service has been completed. Please leave a review!',
            [booking_entity_1.BookingStatus.CANCELLED]: 'Your booking has been cancelled.',
        };
        console.log(`Booking status update: ${booking.bookingId} - ${statusMessages[newStatus]}`);
    }
    async sendBookingCancellation(booking) {
        console.log(`Booking cancellation email would be sent for booking ${booking.bookingId}`);
    }
    async sendPaymentConfirmation(payment, booking) {
        console.log(`Payment confirmation would be sent for payment ${payment.paymentId}`);
    }
    async sendNewReviewNotification(review, provider) {
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
    async sendReviewRequestEmail(email, customerName, bookingId) {
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
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], MailService);
//# sourceMappingURL=mail.service.js.map