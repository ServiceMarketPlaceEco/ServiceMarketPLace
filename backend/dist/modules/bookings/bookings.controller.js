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
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bookings_service_1 = require("./bookings.service");
const dto_1 = require("./dto");
const guards_1 = require("../auth/guards");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let BookingsController = class BookingsController {
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    async findAll(query) {
        return this.bookingsService.findAll(query);
    }
    async findAllPublic(query) {
        return this.bookingsService.findAll(query);
    }
    async updateStatus(id, body) {
        return this.bookingsService.updateStatusAdmin(id, body.status);
    }
    async create(user, dto) {
        return this.bookingsService.create(user.userId, dto);
    }
    async getMyBookings(user, query) {
        return this.bookingsService.findByCustomer(user.userId, query);
    }
    async findOne(user, id) {
        const booking = await this.bookingsService.findById(id);
        if (user.userType === 'customer' && booking.customerId !== user.userId) {
            return { error: 'Access denied' };
        }
        if (user.userType === 'provider' && booking.providerService?.providerId !== user.userId) {
            return { error: 'Access denied' };
        }
        return booking;
    }
    async update(user, id, dto) {
        return this.bookingsService.update(user.userId, id, dto);
    }
    async cancel(user, id) {
        return this.bookingsService.cancel(user.userId, id);
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.AdminGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all bookings (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of all bookings' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.BookingQueryDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('all'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all bookings (Public - for demo admin dashboard)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of all bookings' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.BookingQueryDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "findAllPublic", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Update booking status (Public - for demo admin)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking status updated' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.CustomerGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new booking (Customer only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Booking created', type: dto_1.BookingResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Service not available' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateBookingDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('my-bookings'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.CustomerGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all bookings for the current customer' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of customer bookings' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.BookingQueryDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getMyBookings", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Get booking by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking details', type: dto_1.BookingResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Booking not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.CustomerGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Update booking (Customer only, pending bookings)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking updated', type: dto_1.BookingResponseDto }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dto_1.UpdateBookingDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id/cancel'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.CustomerGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a booking (Customer only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking cancelled' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "cancel", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)('bookings'),
    (0, common_1.Controller)('bookings'),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map