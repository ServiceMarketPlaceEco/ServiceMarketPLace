import { BookingStatus } from '../entities/booking.entity';
export declare class CreateBookingDto {
    providerServiceId?: string;
    serviceId?: string;
    providerId?: string;
    date: string;
    time: string;
    notes?: string;
    address?: string;
    serviceName?: string;
    providerName?: string;
}
export declare class UpdateBookingDto {
    date?: string;
    time?: string;
    notes?: string;
    address?: string;
}
export declare class BookingQueryDto {
    status?: BookingStatus;
    fromDate?: string;
    toDate?: string;
}
export declare class BookingResponseDto {
    bookingId: string;
    customerId: string;
    providerServiceId: string;
    date: Date;
    time: string;
    status: BookingStatus;
    notes: string;
    address: string;
    totalAmount: number;
    createdAt: Date;
}
