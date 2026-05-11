import { Repository } from 'typeorm';
import { BlockReport } from './entities/block-report.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { CreateReportDto, UpdateReportStatusDto, ReportQueryDto } from './dto';
export declare class ReportsService {
    private reportRepository;
    private customerRepository;
    private providerRepository;
    constructor(reportRepository: Repository<BlockReport>, customerRepository: Repository<Customer>, providerRepository: Repository<ServiceProvider>);
    create(reporterId: string, reporterType: 'customer' | 'provider', dto: CreateReportDto): Promise<BlockReport>;
    findById(reportId: string): Promise<BlockReport>;
    findByReporter(reporterId: string): Promise<BlockReport[]>;
    findAll(query?: ReportQueryDto): Promise<BlockReport[]>;
    updateStatus(adminId: string, reportId: string, dto: UpdateReportStatusDto): Promise<BlockReport>;
    blockReportedUser(reportId: string): Promise<void>;
    getStats(): Promise<any>;
}
