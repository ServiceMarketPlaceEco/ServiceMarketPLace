export declare class UpdateProviderProfileDto {
    providerName?: string;
    abn?: number;
    address?: string;
    postalCode?: number;
    phone?: number;
    description?: string;
    profileImage?: string;
}
export declare class AddProviderServiceDto {
    serviceId: string;
    price?: number;
    description?: string;
}
export declare class UpdateProviderServiceDto {
    price?: number;
    description?: string;
    isAvailable?: boolean;
}
export declare class UpdateBookingStatusDto {
    status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
}
export declare class ProviderResponseDto {
    providerId: string;
    providerName: string;
    email: string;
    abn: number;
    address: string;
    postalCode: number;
    phone: number;
    description: string;
    profileImage: string;
    rating: number;
    totalReviews: number;
    isVerified: boolean;
    isActive: boolean;
    createdAt: Date;
}
export declare class ProviderListQueryDto {
    serviceId?: string;
    search?: string;
    verified?: boolean;
    minRating?: number;
}
