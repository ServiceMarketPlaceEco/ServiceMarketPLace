import { ReportsService } from './reports.service';
import { CreateReportDto, UpdateReportStatusDto, ReportQueryDto } from './dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    create(user: CurrentUserData, dto: CreateReportDto): Promise<import("./entities/block-report.entity").BlockReport>;
    findMyReports(user: CurrentUserData): Promise<import("./entities/block-report.entity").BlockReport[]>;
    findOne(id: string): Promise<import("./entities/block-report.entity").BlockReport>;
    findAll(query: ReportQueryDto): Promise<import("./entities/block-report.entity").BlockReport[]>;
    updateStatus(user: CurrentUserData, id: string, dto: UpdateReportStatusDto): Promise<import("./entities/block-report.entity").BlockReport>;
    blockUser(id: string): Promise<{
        message: string;
    }>;
}
