import { Repository } from 'typeorm';
import { ServiceProvider } from './entities/service-provider.entity';
import { ProviderService } from './entities/provider-service.entity';
import { UpdateProviderProfileDto, AddProviderServiceDto, UpdateProviderServiceDto, ProviderListQueryDto } from './dto';
import { ChangePasswordDto } from '../customers/dto';
export declare class ProvidersService {
    private providerRepository;
    private providerServiceRepository;
    constructor(providerRepository: Repository<ServiceProvider>, providerServiceRepository: Repository<ProviderService>);
    findAll(query: ProviderListQueryDto): Promise<ServiceProvider[]>;
    findById(providerId: string): Promise<ServiceProvider>;
    getPublicProfile(providerId: string): Promise<any>;
    getProfile(providerId: string): Promise<ServiceProvider>;
    updateProfile(providerId: string, dto: UpdateProviderProfileDto): Promise<ServiceProvider>;
    changePassword(providerId: string, dto: ChangePasswordDto): Promise<void>;
    addService(providerId: string, dto: AddProviderServiceDto): Promise<ProviderService>;
    updateService(providerId: string, serviceId: string, dto: UpdateProviderServiceDto): Promise<ProviderService>;
    removeService(providerId: string, serviceId: string): Promise<void>;
    getServices(providerId: string): Promise<ProviderService[]>;
    findAllAdmin(): Promise<ServiceProvider[]>;
    verifyProvider(providerId: string, verify: boolean): Promise<ServiceProvider>;
    blockProvider(providerId: string, block: boolean): Promise<ServiceProvider>;
    updateRating(providerId: string, newRating: number, totalReviews: number): Promise<void>;
}
