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
    providerServiceId: string | null;
    jobId: string | null;
    paymentId: string | null;
    date: Date;
    time: string;
    status: BookingStatus;
    notes: string | null;
    address: string | null;
    totalAmount: number | null;
    createdAt: Date;
    updatedAt: Date;
    customer: Customer;
    providerService: ProviderService;
    payment: Payment;
    reviews: Review[];
}
