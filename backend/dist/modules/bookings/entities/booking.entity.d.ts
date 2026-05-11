import { Customer } from '../../customers/entities/customer.entity';
import { ProviderService } from '../../providers/entities/provider-service.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Review } from '../../reviews/entities/review.entity';
export declare enum BookingStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export declare class Booking {
    bookingId: string;
    customerId: string;
    providerServiceId: string;
    jobId: string;
    paymentId: string;
    date: Date;
    time: string;
    status: BookingStatus;
    notes: string;
    address: string;
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
    customer: Customer;
    providerService: ProviderService;
    payment: Payment;
    reviews: Review[];
}
