"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const block_report_entity_1 = require("./entities/block-report.entity");
const customer_entity_1 = require("../customers/entities/customer.entity");
const service_provider_entity_1 = require("../providers/entities/service-provider.entity");
let ReportsService = class ReportsService {
    constructor(reportRepository, customerRepository, providerRepository) {
        this.reportRepository = reportRepository;
        this.customerRepository = customerRepository;
        this.providerRepository = providerRepository;
    }
    async create(reporterId, reporterType, dto) {
        if (dto.reportedType === block_report_entity_1.ReportedType.CUSTOMER) {
            const customer = await this.customerRepository.findOne({
                where: { customerId: dto.reportedId },
            });
            if (!customer) {
                throw new common_1.NotFoundException('Reported customer not found');
            }
        }
        else {
            const provider = await this.providerRepository.findOne({
                where: { providerId: dto.reportedId },
            });
            if (!provider) {
                throw new common_1.NotFoundException('Reported provider not found');
            }
        }
        const report = this.reportRepository.create({
            reporterId,
            reporterType: reporterType === 'customer' ? block_report_entity_1.ReporterType.CUSTOMER : block_report_entity_1.ReporterType.PROVIDER,
            reportedId: dto.reportedId,
            reportedType: dto.reportedType,
            reason: dto.reason,
            status: block_report_entity_1.ReportStatus.PENDING,
        });
        return this.reportRepository.save(report);
    }
    async findById(reportId) {
        const report = await this.reportRepository.findOne({
            where: { reportId },
            relations: ['resolvedByAdmin'],
        });
        if (!report) {
            throw new common_1.NotFoundException('Report not found');
        }
        return report;
    }
    async findByReporter(reporterId) {
        return this.reportRepository.find({
            where: { reporterId },
            order: { createdAt: 'DESC' },
        });
    }
    async findAll(query) {
        const where = {};
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
    async updateStatus(adminId, reportId, dto) {
        const report = await this.findById(reportId);
        report.status = dto.status;
        report.adminNotes = dto.adminNotes || report.adminNotes;
        if ([block_report_entity_1.ReportStatus.RESOLVED, block_report_entity_1.ReportStatus.DISMISSED].includes(dto.status)) {
            report.resolvedBy = adminId;
        }
        return this.reportRepository.save(report);
    }
    async blockReportedUser(reportId) {
        const report = await this.findById(reportId);
        if (report.reportedType === block_report_entity_1.ReportedType.CUSTOMER) {
            await this.customerRepository.update({ customerId: report.reportedId }, { isBlocked: true });
        }
        else {
            await this.providerRepository.update({ providerId: report.reportedId }, { isBlocked: true });
        }
        report.status = block_report_entity_1.ReportStatus.RESOLVED;
        await this.reportRepository.save(report);
    }
    async getStats() {
        const total = await this.reportRepository.count();
        const pending = await this.reportRepository.count({ where: { status: block_report_entity_1.ReportStatus.PENDING } });
        const reviewed = await this.reportRepository.count({ where: { status: block_report_entity_1.ReportStatus.REVIEWED } });
        const resolved = await this.reportRepository.count({ where: { status: block_report_entity_1.ReportStatus.RESOLVED } });
        const dismissed = await this.reportRepository.count({ where: { status: block_report_entity_1.ReportStatus.DISMISSED } });
        return { total, pending, reviewed, resolved, dismissed };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(block_report_entity_1.BlockReport)),
    __param(1, (0, typeorm_1.InjectRepository)(customer_entity_1.Customer)),
    __param(2, (0, typeorm_1.InjectRepository)(service_provider_entity_1.ServiceProvider)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map