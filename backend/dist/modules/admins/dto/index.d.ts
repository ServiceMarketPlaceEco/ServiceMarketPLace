import { AdminRole } from '../entities/admin.entity';
export declare class CreateAdminDto {
    name: string;
    email: string;
    password: string;
    role?: AdminRole;
}
export declare class UpdateAdminDto {
    name?: string;
    email?: string;
    role?: AdminRole;
}
export declare class AdminDashboardStatsDto {
    totalCustomers: number;
    totalProviders: number;
    totalBookings: number;
    pendingBookings: number;
    completedBookings: number;
    totalRevenue: number;
    pendingReports: number;
    recentBookings: any[];
    recentReviews: any[];
}
