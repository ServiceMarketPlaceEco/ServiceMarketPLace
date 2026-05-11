import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto';
export declare class ServicesService {
    private serviceRepository;
    constructor(serviceRepository: Repository<Service>);
    findAll(): Promise<Service[]>;
    findAllAdmin(): Promise<Service[]>;
    findOne(id: string): Promise<Service>;
    findProvidersForService(serviceId: string): Promise<any[]>;
    create(dto: CreateServiceDto): Promise<Service>;
    update(id: string, dto: UpdateServiceDto): Promise<Service>;
    remove(id: string): Promise<void>;
}
