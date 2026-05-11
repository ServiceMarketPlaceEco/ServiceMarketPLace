import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Review } from '../../reviews/entities/review.entity';
export declare class Customer {
    customerId: string;
    name: string;
    email: string;
    passwordHash: string;
    age: number;
    phone: string;
    address: string;
    profileImage: string;
    isActive: boolean;
    isBlocked: boolean;
    createdAt: Date;
    updatedAt: Date;
    bookings: Booking[];
    payments: Payment[];
    reviews: Review[];
}
