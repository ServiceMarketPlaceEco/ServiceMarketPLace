import { ProviderService } from '../../providers/entities/provider-service.entity';
export declare class Service {
    serviceId: string;
    serviceName: string;
    description: string;
    icon: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    providerServices: ProviderService[];
}
