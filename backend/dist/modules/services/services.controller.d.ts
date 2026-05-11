import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';
export declare class ServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    findAll(): Promise<import("./entities/service.entity").Service[]>;
    findOne(id: string): Promise<import("./entities/service.entity").Service>;
    findProvidersForService(id: string): Promise<any[]>;
    create(dto: CreateServiceDto): Promise<import("./entities/service.entity").Service>;
    update(id: string, dto: UpdateServiceDto): Promise<import("./entities/service.entity").Service>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
