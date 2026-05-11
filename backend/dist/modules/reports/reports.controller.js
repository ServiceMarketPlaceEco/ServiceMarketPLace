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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reports_service_1 = require("./reports.service");
const dto_1 = require("./dto");
const guards_1 = require("../auth/guards");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let ReportsController = class ReportsController {
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    async create(user, dto) {
        return this.reportsService.create(user.userId, user.userType, dto);
    }
    async findMyReports(user) {
        return this.reportsService.findByReporter(user.userId);
    }
    async findOne(id) {
        return this.reportsService.findById(id);
    }
    async findAll(query) {
        return this.reportsService.findAll(query);
    }
    async updateStatus(user, id, dto) {
        return this.reportsService.updateStatus(user.userId, id, dto);
    }
    async blockUser(id) {
        await this.reportsService.blockReportedUser(id);
        return { message: 'User blocked successfully' };
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Submit a report against a user' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Report submitted', type: dto_1.ReportResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Reported user not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateReportDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('my-reports'),
    (0, swagger_1.ApiOperation)({ summary: 'Get reports submitted by current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of reports', type: [dto_1.ReportResponseDto] }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "findMyReports", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get report by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Report details', type: dto_1.ReportResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Report not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(guards_1.AdminGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get all reports (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of all reports', type: [dto_1.ReportResponseDto] }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ReportQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    (0, common_1.UseGuards)(guards_1.AdminGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Update report status (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Report updated', type: dto_1.ReportResponseDto }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dto_1.UpdateReportStatusDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Put)(':id/block-user'),
    (0, common_1.UseGuards)(guards_1.AdminGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Block reported user (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User blocked' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "blockUser", null);
exports.ReportsController = ReportsController = __decorate([
    (0, swagger_1.ApiTags)('reports'),
    (0, common_1.Controller)('reports'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map