import { Customer } from '../../customers/entities/customer.entity';
import { Booking } from '../../bookings/entities/booking.entity';
export declare enum PaymentStatus {
    PENDING = "pending",
    COMPLETED = "completed",
    FAILED = "failed",
    REFUNDED = "refunded"
}
export declare enum PaymentMethod {
    CREDIT_CARD = "credit_card",
    DEBIT_CARD = "debit_card",
    PAYPAL = "paypal",
    BANK_TRANSFER = "bank_transfer",
    CASH = "cash"
}
export declare class Payment {
    paymentId: string;
    bookingId: string;
    customerId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    transactionId: string;
    paymentDate: Date;
    createdAt: Date;
    updatedAt: Date;
    customer: Customer;
    booking: Booking;
}
