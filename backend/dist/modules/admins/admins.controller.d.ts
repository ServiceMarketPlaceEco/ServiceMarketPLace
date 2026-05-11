import { AdminsService } from './admins.service';
import { CreateAdminDto, UpdateAdminDto } from './dto';
export declare class AdminsController {
    private readonly adminsService;
    constructor(adminsService: AdminsService);
    create(createAdminDto: CreateAdminDto): Promise<import("./entities/admin.entity").Admin>;
    findAll(): Promise<import("./entities/admin.entity").Admin[]>;
    getDashboardStats(): Promise<import("./dto").AdminDashboardStatsDto>;
    getAllCustomers(page?: number, limit?: number): Promise<{
        data: import("../customers/entities/customer.entity").Customer[];
        total: number;
    }>;
    getAllProviders(page?: number, limit?: number): Promise<{
        data: import("../providers/entities/service-provider.entity").ServiceProvider[];
        total: number;
    }>;
    findOne(id: string): Promise<import("./entities/admin.entity").Admin>;
    update(id: string, updateAdminDto: UpdateAdminDto): Promise<import("./entities/admin.entity").Admin>;
    deactivate(id: string): Promise<import("./entities/admin.entity").Admin>;
    activate(id: string): Promise<import("./entities/admin.entity").Admin>;
    verifyProvider(id: string): Promise<import("../providers/entities/service-provider.entity").ServiceProvider>;
    suspendUser(userType: 'customer' | 'provider', id: string, reason: string): Promise<void>;
    activateUser(userType: 'customer' | 'provider', id: string): Promise<void>;
}
