import { Admin } from '../../admins/entities/admin.entity';
export declare enum ReporterType {
    CUSTOMER = "customer",
    PROVIDER = "provider",
    ADMIN = "admin"
}
export declare enum ReportedType {
    CUSTOMER = "customer",
    PROVIDER = "provider"
}
export declare enum ReportStatus {
    PENDING = "pending",
    REVIEWED = "reviewed",
    RESOLVED = "resolved",
    DISMISSED = "dismissed"
}
export declare class BlockReport {
    reportId: string;
    reporterId: string;
    reporterType: ReporterType;
    reportedId: string;
    reportedType: ReportedType;
    reason: string;
    status: ReportStatus;
    adminNotes: string;
    resolvedBy: string;
    createdAt: Date;
    updatedAt: Date;
    resolvedByAdmin: Admin;
}
