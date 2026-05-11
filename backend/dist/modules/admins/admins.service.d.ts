import { Repository } from 'typeorm';
import { Admin } from './entities/admin.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { BlockReport } from '../reports/entities/block-report.entity';
import { CreateAdminDto, UpdateAdminDto, AdminDashboardStatsDto } from './dto';
export declare class AdminsService {
    private adminRepository;
    private customerRepository;
    private providerRepository;
    private bookingRepository;
    private paymentRepository;
    private reviewRepository;
    private reportRepository;
    constructor(adminRepository: Repository<Admin>, customerRepository: Repository<Customer>, providerRepository: Repository<ServiceProvider>, bookingRepository: Repository<Booking>, paymentRepository: Repository<Payment>, reviewRepository: Repository<Review>, reportRepository: Repository<BlockReport>);
    create(createAdminDto: CreateAdminDto): Promise<Admin>;
    findAll(): Promise<Admin[]>;
    findOne(id: string): Promise<Admin>;
    findByEmail(email: string): Promise<Admin | null>;
    update(id: string, updateAdminDto: UpdateAdminDto): Promise<Admin>;
    deactivate(id: string): Promise<Admin>;
    activate(id: string): Promise<Admin>;
    getDashboardStats(): Promise<AdminDashboardStatsDto>;
    getAllCustomers(page?: number, limit?: number): Promise<{
        data: Customer[];
        total: number;
    }>;
    getAllProviders(page?: number, limit?: number): Promise<{
        data: ServiceProvider[];
        total: number;
    }>;
    verifyProvider(providerId: string): Promise<ServiceProvider>;
    suspendUser(userType: 'customer' | 'provider', userId: string, reason: string): Promise<void>;
    activateUser(userType: 'customer' | 'provider', userId: string): Promise<void>;
}
