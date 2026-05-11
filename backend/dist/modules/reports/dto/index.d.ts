import { ReportedType, ReportStatus } from '../entities/block-report.entity';
export declare class CreateReportDto {
    reportedId: string;
    reportedType: ReportedType;
    reason: string;
}
export declare class UpdateReportStatusDto {
    status: ReportStatus;
    adminNotes?: string;
}
export declare class ReportQueryDto {
    status?: ReportStatus;
    reportedType?: ReportedType;
}
export declare class ReportResponseDto {
    reportId: string;
    reporterId: string;
    reporterType: string;
    reportedId: string;
    reportedType: string;
    reason: string;
    status: ReportStatus;
    adminNotes: string;
    resolvedBy: string;
    createdAt: Date;
}
