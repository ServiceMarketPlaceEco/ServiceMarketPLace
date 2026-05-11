import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { CreatePaymentDto, PaymentQueryDto } from './dto';
import { MailService } from '../mail/mail.service';
export declare class PaymentsService {
    private paymentRepository;
    private bookingRepository;
    private mailService;
    constructor(paymentRepository: Repository<Payment>, bookingRepository: Repository<Booking>, mailService: MailService);
    create(customerId: string, dto: CreatePaymentDto): Promise<Payment>;
    findById(paymentId: string): Promise<Payment>;
    findByBooking(bookingId: string): Promise<Payment | null>;
    findByCustomer(customerId: string, query?: PaymentQueryDto): Promise<Payment[]>;
    findAll(query?: PaymentQueryDto): Promise<Payment[]>;
    refund(paymentId: string): Promise<Payment>;
    getStats(): Promise<any>;
}
