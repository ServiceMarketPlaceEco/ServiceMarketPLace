import { ServiceProvider } from './service-provider.entity';
import { Service } from '../../services/entities/service.entity';
import { Booking } from '../../bookings/entities/booking.entity';
export declare class ProviderService {
    id: string;
    providerId: string;
    serviceId: string;
    price: number;
    description: string;
    isAvailable: boolean;
    createdAt: Date;
    updatedAt: Date;
    provider: ServiceProvider;
    service: Service;
    bookings: Booking[];
}
