import { ConfigService } from '@nestjs/config';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Service } from '../services/entities/service.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
export declare class MailService {
    private configService;
    private transporter;
    private fromEmail;
    private fromName;
    private appUrl;
    constructor(configService: ConfigService);
    private sendMail;
    sendWelcomeEmail(email: string, name: string): Promise<void>;
    sendProviderWelcomeEmail(email: string, providerName: string): Promise<void>;
    sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void>;
    sendBookingConfirmation(booking: Booking, provider: ServiceProvider, service: Service): Promise<void>;
    sendBookingStatusUpdate(booking: Booking, newStatus: BookingStatus): Promise<void>;
    sendBookingCancellation(booking: Booking): Promise<void>;
    sendPaymentConfirmation(payment: Payment, booking: Booking): Promise<void>;
    sendNewReviewNotification(review: Review, provider: ServiceProvider): Promise<void>;
    sendReviewRequestEmail(email: string, customerName: string, bookingId: string): Promise<void>;
}
