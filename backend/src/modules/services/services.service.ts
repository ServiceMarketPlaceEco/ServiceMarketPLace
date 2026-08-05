import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
  ) {}

  async findAll(): Promise<Service[]> {
    return this.serviceRepository.find({
      where: { isActive: true },
      order: { serviceName: 'ASC' },
    });
  }

  async findAllAdmin(): Promise<Service[]> {
    return this.serviceRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { serviceId: id },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async findProvidersForService(serviceId: string): Promise<any[]> {
    const service = await this.serviceRepository.findOne({
      where: { serviceId, isActive: true },
      relations: ['providerServices', 'providerServices.provider'],
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Return providers offering this service
    return service.providerServices
      .filter((ps) => ps.isAvailable && ps.provider.isActive && !ps.provider.isBlocked)
      .map((ps) => ({
        providerServiceId: ps.id,
        providerId: ps.provider.providerId,
        providerName: ps.provider.providerName,
        description: ps.provider.description,
        address: ps.provider.address,
        rating: ps.provider.rating,
        totalReviews: ps.provider.totalReviews,
        isVerified: ps.provider.isVerified,
        profileImage: ps.provider.profileImage,
        price: ps.price,
        serviceDescription: ps.description,
      }));
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const service = this.serviceRepository.create(dto);
    return this.serviceRepository.save(service);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);
    Object.assign(service, dto);
    return this.serviceRepository.save(service);
  }

  async remove(id: string): Promise<void> {
    const service = await this.findOne(id);
    await this.serviceRepository.remove(service);
  }
}
