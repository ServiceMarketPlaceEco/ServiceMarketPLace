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
exports.ProvidersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const providers_service_1 = require("./providers.service");
const dto_1 = require("./dto");
const dto_2 = require("../customers/dto");
const guards_1 = require("../auth/guards");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const bookings_service_1 = require("../bookings/bookings.service");
let ProvidersController = class ProvidersController {
    constructor(providersService, bookingsService) {
        this.providersService = providersService;
        this.bookingsService = bookingsService;
    }
    async findAll(query) {
        return this.providersService.findAll(query);
    }
    async findOne(id) {
        return this.providersService.getPublicProfile(id);
    }
    async getProfile(user) {
        return this.providersService.getProfile(user.userId);
    }
    async updateProfile(user, dto) {
        return this.providersService.updateProfile(user.userId, dto);
    }
    async changePassword(user, dto) {
        await this.providersService.changePassword(user.userId, dto);
        return { message: 'Password changed successfully' };
    }
    async getServices(user) {
        return this.providersService.getServices(user.userId);
    }
    async addService(user, dto) {
        return this.providersService.addService(user.userId, dto);
    }
    async updateService(user, serviceId, dto) {
        return this.providersService.updateService(user.userId, serviceId, dto);
    }
    async removeService(user, serviceId) {
        await this.providersService.removeService(user.userId, serviceId);
        return { message: 'Service removed successfully' };
    }
    async getBookings(user) {
        return this.bookingsService.findByProvider(user.userId);
    }
    async updateBookingStatus(user, bookingId, dto) {
        return this.bookingsService.updateStatusByProvider(user.userId, bookingId, dto.status);
    }
};
exports.ProvidersController = ProvidersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all active providers' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of providers' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ProviderListQueryDto]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get provider public profile by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Provider details', type: dto_1.ProviderResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Provider not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('me/profile'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current provider profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Provider profile', type: dto_1.ProviderResponseDto }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Put)('me/profile'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Update provider profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile updated', type: dto_1.ProviderResponseDto }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.UpdateProviderProfileDto]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Put)('me/change-password'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Change provider password' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password changed successfully' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_2.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Get)('me/services'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Get provider services' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of services offered' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "getServices", null);
__decorate([
    (0, common_1.Post)('me/services'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a new service offering' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Service added' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Already offering this service' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AddProviderServiceDto]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "addService", null);
__decorate([
    (0, common_1.Put)('me/services/:serviceId'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a service offering' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Service updated' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('serviceId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dto_1.UpdateProviderServiceDto]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "updateService", null);
__decorate([
    (0, common_1.Delete)('me/services/:serviceId'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a service offering' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Service removed' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('serviceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "removeService", null);
__decorate([
    (0, common_1.Get)('me/bookings'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Get provider bookings' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of provider bookings' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "getBookings", null);
__decorate([
    (0, common_1.Put)('me/bookings/:bookingId/status'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.ProviderGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Update booking status' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking status updated' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('bookingId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dto_1.UpdateBookingStatusDto]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "updateBookingStatus", null);
exports.ProvidersController = ProvidersController = __decorate([
    (0, swagger_1.ApiTags)('providers'),
    (0, common_1.Controller)('providers'),
    __metadata("design:paramtypes", [providers_service_1.ProvidersService,
        bookings_service_1.BookingsService])
], ProvidersController);
//# sourceMappingURL=providers.controller.js.map