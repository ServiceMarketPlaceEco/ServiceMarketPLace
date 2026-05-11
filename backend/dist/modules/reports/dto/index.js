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
exports.ReportResponseDto = exports.ReportQueryDto = exports.UpdateReportStatusDto = exports.CreateReportDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const block_report_entity_1 = require("../entities/block-report.entity");
class CreateReportDto {
}
exports.CreateReportDto = CreateReportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'uuid-of-reported-user' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateReportDto.prototype, "reportedId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: block_report_entity_1.ReportedType, example: 'provider' }),
    (0, class_validator_1.IsEnum)(block_report_entity_1.ReportedType),
    __metadata("design:type", String)
], CreateReportDto.prototype, "reportedType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'This provider was very unprofessional and rude.' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReportDto.prototype, "reason", void 0);
class UpdateReportStatusDto {
}
exports.UpdateReportStatusDto = UpdateReportStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: block_report_entity_1.ReportStatus, example: 'reviewed' }),
    (0, class_validator_1.IsEnum)(block_report_entity_1.ReportStatus),
    __metadata("design:type", String)
], UpdateReportStatusDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Warning issued to provider' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateReportStatusDto.prototype, "adminNotes", void 0);
class ReportQueryDto {
}
exports.ReportQueryDto = ReportQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: block_report_entity_1.ReportStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(block_report_entity_1.ReportStatus),
    __metadata("design:type", String)
], ReportQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: block_report_entity_1.ReportedType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(block_report_entity_1.ReportedType),
    __metadata("design:type", String)
], ReportQueryDto.prototype, "reportedType", void 0);
class ReportResponseDto {
}
exports.ReportResponseDto = ReportResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "reportId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "reporterId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "reporterType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "reportedId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "reportedType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: block_report_entity_1.ReportStatus }),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "adminNotes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReportResponseDto.prototype, "resolvedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], ReportResponseDto.prototype, "createdAt", void 0);
//# sourceMappingURL=index.js.map