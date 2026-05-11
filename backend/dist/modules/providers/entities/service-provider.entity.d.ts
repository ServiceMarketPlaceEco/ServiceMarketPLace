import { ProviderService } from './provider-service.entity';
import { Review } from '../../reviews/entities/review.entity';
export declare class ServiceProvider {
    providerId: string;
    providerName: string;
    email: string;
    passwordHash: string;
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
    isBlocked: boolean;
    createdAt: Date;
    updatedAt: Date;
    providerServices: ProviderService[];
    reviews: Review[];
}
