import { PaymentMethod, PaymentStatus } from '../entities/payment.entity';
export declare class CreatePaymentDto {
    bookingId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionId?: string;
}
export declare class PaymentQueryDto {
    status?: PaymentStatus;
    fromDate?: string;
    toDate?: string;
}
export declare class PaymentResponseDto {
    paymentId: string;
    bookingId: string;
    customerId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    transactionId: string;
    paymentDate: Date;
    createdAt: Date;
}
