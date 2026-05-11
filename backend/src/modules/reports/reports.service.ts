import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockReport, ReporterType, ReportedType, ReportStatus } from './entities/block-report.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { CreateReportDto, UpdateReportStatusDto, ReportQueryDto } from './dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(BlockReport)
    private reportRepository: Repository<BlockReport>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
  ) {}

  async create(
    reporterId: string,
    reporterType: 'customer' | 'provider',
    dto: CreateReportDto,
  ): Promise<BlockReport> {
    // Verify reported user exists
    if (dto.reportedType === ReportedType.CUSTOMER) {
      const customer = await this.customerRepository.findOne({
        where: { customerId: dto.reportedId },
      });
      if (!customer) {
        throw new NotFoundException('Reported customer not found');
      }
    } else {
      const provider = await this.providerRepository.findOne({
        where: { providerId: dto.reportedId },
      });
      if (!provider) {
        throw new NotFoundException('Reported provider not found');
      }
    }

    const report = this.reportRepository.create({
      reporterId,
      reporterType: reporterType === 'customer' ? ReporterType.CUSTOMER : ReporterType.PROVIDER,
      reportedId: dto.reportedId,
      reportedType: dto.reportedType,
      reason: dto.reason,
      status: ReportStatus.PENDING,
    });

    return this.reportRepository.save(report);
  }

  async findById(reportId: string): Promise<BlockReport> {
    const report = await this.reportRepository.findOne({
      where: { reportId },
      relations: ['resolvedByAdmin'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async findByReporter(reporterId: string): Promise<BlockReport[]> {
    return this.reportRepository.find({
      where: { reporterId },
      order: { createdAt: 'DESC' },
    });
  }

  // Admin methods
  async findAll(query?: ReportQueryDto): Promise<BlockReport[]> {
    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.reportedType) {
      where.reportedType = query.reportedType;
    }

    return this.reportRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    adminId: string,
    reportId: string,
    dto: UpdateReportStatusDto,
  ): Promise<BlockReport> {
    const report = await this.findById(reportId);

    report.status = dto.status;
    report.adminNotes = dto.adminNotes || report.adminNotes;

    if ([ReportStatus.RESOLVED, ReportStatus.DISMISSED].includes(dto.status)) {
      report.resolvedBy = adminId;
    }

    return this.reportRepository.save(report);
  }

  async blockReportedUser(reportId: string): Promise<void> {
    const report = await this.findById(reportId);

    if (report.reportedType === ReportedType.CUSTOMER) {
      await this.customerRepository.update(
        { customerId: report.reportedId },
        { isBlocked: true },
      );
    } else {
      await this.providerRepository.update(
        { providerId: report.reportedId },
        { isBlocked: true },
      );
    }

    report.status = ReportStatus.RESOLVED;
    await this.reportRepository.save(report);
  }

  async getStats(): Promise<any> {
    const total = await this.reportRepository.count();
    const pending = await this.reportRepository.count({ where: { status: ReportStatus.PENDING } });
    const reviewed = await this.reportRepository.count({ where: { status: ReportStatus.REVIEWED } });
    const resolved = await this.reportRepository.count({ where: { status: ReportStatus.RESOLVED } });
    const dismissed = await this.reportRepository.count({ where: { status: ReportStatus.DISMISSED } });

    return { total, pending, reviewed, resolved, dismissed };
  }
}
