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
exports.CustomersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const customers_service_1 = require("./customers.service");
const dto_1 = require("./dto");
const guards_1 = require("../auth/guards");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const bookings_service_1 = require("../bookings/bookings.service");
let CustomersController = class CustomersController {
    constructor(customersService, bookingsService) {
        this.customersService = customersService;
        this.bookingsService = bookingsService;
    }
    async getProfile(user) {
        return this.customersService.getProfile(user.userId);
    }
    async updateProfile(user, dto) {
        return this.customersService.updateProfile(user.userId, dto);
    }
    async changePassword(user, dto) {
        await this.customersService.changePassword(user.userId, dto);
        return { message: 'Password changed successfully' };
    }
    async getBookings(user) {
        return this.bookingsService.findByCustomer(user.userId);
    }
    async deactivateAccount(user) {
        await this.customersService.deactivateAccount(user.userId);
        return { message: 'Account deactivated successfully' };
    }
};
exports.CustomersController = CustomersController;
__decorate([
    (0, common_1.Get)('profile'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current customer profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Customer profile', type: dto_1.CustomerResponseDto }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Put)('profile'),
    (0, swagger_1.ApiOperation)({ summary: 'Update customer profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile updated', type: dto_1.CustomerResponseDto }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.UpdateCustomerProfileDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Put)('change-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Change customer password' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password changed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Current password is incorrect' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Get)('bookings'),
    (0, swagger_1.ApiOperation)({ summary: 'Get customer bookings' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of customer bookings' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "getBookings", null);
__decorate([
    (0, common_1.Delete)('account'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Deactivate customer account' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Account deactivated' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "deactivateAccount", null);
exports.CustomersController = CustomersController = __decorate([
    (0, swagger_1.ApiTags)('customers'),
    (0, common_1.Controller)('customers'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard, guards_1.CustomerGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    __metadata("design:paramtypes", [customers_service_1.CustomersService,
        bookings_service_1.BookingsService])
], CustomersController);
//# sourceMappingURL=customers.controller.js.map