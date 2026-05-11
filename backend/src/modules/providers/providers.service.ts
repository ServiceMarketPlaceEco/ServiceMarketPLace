import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThanOrEqual } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ServiceProvider } from './entities/service-provider.entity';
import { ProviderService } from './entities/provider-service.entity';
import {
  UpdateProviderProfileDto,
  AddProviderServiceDto,
  UpdateProviderServiceDto,
  ProviderListQueryDto,
} from './dto';
import { ChangePasswordDto } from '../customers/dto';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
    @InjectRepository(ProviderService)
    private providerServiceRepository: Repository<ProviderService>,
  ) {}

  async findAll(query: ProviderListQueryDto): Promise<ServiceProvider[]> {
    const where: any = { isActive: true, isBlocked: false };

    if (query.verified !== undefined) {
      where.isVerified = query.verified;
    }

    if (query.minRating) {
      where.rating = MoreThanOrEqual(query.minRating);
    }

    if (query.search) {
      where.providerName = Like(`%${query.search}%`);
    }

    let providers = await this.providerRepository.find({
      where,
      select: [
        'providerId',
        'providerName',
        'address',
        'description',
        'profileImage',
        'rating',
        'totalReviews',
        'isVerified',
      ],
      order: { rating: 'DESC' },
    });

    // Filter by service if provided
    if (query.serviceId) {
      const providerServices = await this.providerServiceRepository.find({
        where: { serviceId: query.serviceId, isAvailable: true },
        select: ['providerId'],
      });
      const providerIds = providerServices.map((ps) => ps.providerId);
      providers = providers.filter((p) => providerIds.includes(p.providerId));
    }

    return providers;
  }

  async findById(providerId: string): Promise<ServiceProvider> {
    const provider = await this.providerRepository.findOne({
      where: { providerId },
      relations: ['providerServices', 'providerServices.service'],
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    return provider;
  }

  async getPublicProfile(providerId: string): Promise<any> {
    const provider = await this.providerRepository.findOne({
      where: { providerId, isActive: true, isBlocked: false },
      select: [
        'providerId',
        'providerName',
        'address',
        'postalCode',
        'description',
        'profileImage',
        'rating',
        'totalReviews',
        'isVerified',
        'createdAt',
      ],
      relations: ['providerServices', 'providerServices.service'],
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Filter available services
    const services = provider.providerServices
      .filter((ps) => ps.isAvailable)
      .map((ps) => ({
        id: ps.id,
        serviceId: ps.serviceId,
        serviceName: ps.service.serviceName,
        price: ps.price,
        description: ps.description,
      }));

    const { providerServices, ...providerData } = provider;
    return { ...providerData, services };
  }

  async getProfile(providerId: string): Promise<ServiceProvider> {
    return this.findById(providerId);
  }

  async updateProfile(providerId: string, dto: UpdateProviderProfileDto): Promise<ServiceProvider> {
    const provider = await this.findById(providerId);
    Object.assign(provider, dto);
    return this.providerRepository.save(provider);
  }

  async changePassword(providerId: string, dto: ChangePasswordDto): Promise<void> {
    const provider = await this.providerRepository.findOne({
      where: { providerId },
      select: ['providerId', 'passwordHash'],
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, provider.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    provider.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.providerRepository.save(provider);
  }

  // Provider Services Management
  async addService(providerId: string, dto: AddProviderServiceDto): Promise<ProviderService> {
    // Check if already offering this service
    const existing = await this.providerServiceRepository.findOne({
      where: { providerId, serviceId: dto.serviceId },
    });

    if (existing) {
      throw new ConflictException('Already offering this service');
    }

    const providerService = this.providerServiceRepository.create({
      providerId,
      serviceId: dto.serviceId,
      price: dto.price,
      description: dto.description,
    });

    return this.providerServiceRepository.save(providerService);
  }

  async updateService(
    providerId: string,
    serviceId: string,
    dto: UpdateProviderServiceDto,
  ): Promise<ProviderService> {
    const providerService = await this.providerServiceRepository.findOne({
      where: { id: serviceId, providerId },
    });

    if (!providerService) {
      throw new NotFoundException('Service offering not found');
    }

    Object.assign(providerService, dto);
    return this.providerServiceRepository.save(providerService);
  }

  async removeService(providerId: string, serviceId: string): Promise<void> {
    const providerService = await this.providerServiceRepository.findOne({
      where: { id: serviceId, providerId },
    });

    if (!providerService) {
      throw new NotFoundException('Service offering not found');
    }

    await this.providerServiceRepository.remove(providerService);
  }

  async getServices(providerId: string): Promise<ProviderService[]> {
    return this.providerServiceRepository.find({
      where: { providerId },
      relations: ['service'],
    });
  }

  // Admin methods
  async findAllAdmin(): Promise<ServiceProvider[]> {
    return this.providerRepository.find({
      select: [
        'providerId',
        'providerName',
        'email',
        'abn',
        'address',
        'phone',
        'rating',
        'totalReviews',
        'isVerified',
        'isActive',
        'isBlocked',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async verifyProvider(providerId: string, verify: boolean): Promise<ServiceProvider> {
    const provider = await this.findById(providerId);
    provider.isVerified = verify;
    return this.providerRepository.save(provider);
  }

  async blockProvider(providerId: string, block: boolean): Promise<ServiceProvider> {
    const provider = await this.findById(providerId);
    provider.isBlocked = block;
    return this.providerRepository.save(provider);
  }

  // Rating update method (called from reviews service)
  async updateRating(providerId: string, newRating: number, totalReviews: number): Promise<void> {
    await this.providerRepository.update(providerId, {
      rating: newRating,
      totalReviews,
    });
  }
}
