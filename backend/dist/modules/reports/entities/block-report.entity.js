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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockReport = exports.ReportStatus = exports.ReportedType = exports.ReporterType = void 0;
const typeorm_1 = require("typeorm");
const admin_entity_1 = require("../../admins/entities/admin.entity");
var ReporterType;
(function (ReporterType) {
    ReporterType["CUSTOMER"] = "customer";
    ReporterType["PROVIDER"] = "provider";
    ReporterType["ADMIN"] = "admin";
})(ReporterType || (exports.ReporterType = ReporterType = {}));
var ReportedType;
(function (ReportedType) {
    ReportedType["CUSTOMER"] = "customer";
    ReportedType["PROVIDER"] = "provider";
})(ReportedType || (exports.ReportedType = ReportedType = {}));
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["PENDING"] = "pending";
    ReportStatus["REVIEWED"] = "reviewed";
    ReportStatus["RESOLVED"] = "resolved";
    ReportStatus["DISMISSED"] = "dismissed";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
let BlockReport = class BlockReport {
};
exports.BlockReport = BlockReport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'report_id' }),
    __metadata("design:type", String)
], BlockReport.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reporter_id' }),
    __metadata("design:type", String)
], BlockReport.prototype, "reporterId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'reporter_type',
        type: 'enum',
        enum: ReporterType,
    }),
    __metadata("design:type", String)
], BlockReport.prototype, "reporterType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reported_id' }),
    __metadata("design:type", String)
], BlockReport.prototype, "reportedId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'reported_type',
        type: 'enum',
        enum: ReportedType,
    }),
    __metadata("design:type", String)
], BlockReport.prototype, "reportedType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], BlockReport.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ReportStatus,
        default: ReportStatus.PENDING,
    }),
    __metadata("design:type", String)
], BlockReport.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'admin_notes', type: 'text', nullable: true }),
    __metadata("design:type", String)
], BlockReport.prototype, "adminNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_by', nullable: true }),
    __metadata("design:type", String)
], BlockReport.prototype, "resolvedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], BlockReport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], BlockReport.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => admin_entity_1.Admin, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'resolved_by' }),
    __metadata("design:type", admin_entity_1.Admin)
], BlockReport.prototype, "resolvedByAdmin", void 0);
exports.BlockReport = BlockReport = __decorate([
    (0, typeorm_1.Entity)('block_reports')
], BlockReport);
//# sourceMappingURL=block-report.entity.js.map