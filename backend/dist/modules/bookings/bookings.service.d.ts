import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { ProviderService } from '../providers/entities/provider-service.entity';
import { CreateBookingDto, UpdateBookingDto, BookingQueryDto } from './dto';
import { MailService } from '../mail/mail.service';
export declare class BookingsService {
    private bookingRepository;
    private providerServiceRepository;
    private mailService;
    constructor(bookingRepository: Repository<Booking>, providerServiceRepository: Repository<ProviderService>, mailService: MailService);
    create(customerId: string, dto: CreateBookingDto): Promise<Booking>;
    findById(bookingId: string): Promise<Booking>;
    findByCustomer(customerId: string, query?: BookingQueryDto): Promise<Booking[]>;
    findByProvider(providerId: string, query?: BookingQueryDto): Promise<Booking[]>;
    update(customerId: string, bookingId: string, dto: UpdateBookingDto): Promise<Booking>;
    cancel(customerId: string, bookingId: string): Promise<Booking>;
    updateStatusByProvider(providerId: string, bookingId: string, status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled'): Promise<Booking>;
    findAll(query?: BookingQueryDto): Promise<Booking[]>;
    updateStatusAdmin(bookingId: string, status: string): Promise<Booking>;
    getStats(): Promise<any>;
}
