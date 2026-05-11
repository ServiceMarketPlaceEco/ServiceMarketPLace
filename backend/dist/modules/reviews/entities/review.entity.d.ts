import { Customer } from '../../customers/entities/customer.entity';
import { ServiceProvider } from '../../providers/entities/service-provider.entity';
import { Booking } from '../../bookings/entities/booking.entity';
export declare class Review {
    reviewId: string;
    bookingId: string;
    customerId: string;
    providerId: string;
    rating: number;
    comment: string;
    createdAt: Date;
    updatedAt: Date;
    booking: Booking;
    customer: Customer;
    provider: ServiceProvider;
}
