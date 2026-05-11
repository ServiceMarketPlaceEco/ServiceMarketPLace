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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const payments_service_1 = require("./payments.service");
const dto_1 = require("./dto");
const guards_1 = require("../auth/guards");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let PaymentsController = class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    async create(user, dto) {
        return this.paymentsService.create(user.userId, dto);
    }
    async findOne(user, id) {
        const payment = await this.paymentsService.findById(id);
        if (user.userType === 'customer' && payment.customerId !== user.userId) {
            return { error: 'Access denied' };
        }
        return payment;
    }
    async findByBooking(bookingId) {
        return this.paymentsService.findByBooking(bookingId);
    }
    async findCustomerPayments(user, query) {
        return this.paymentsService.findByCustomer(user.userId, query);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(guards_1.CustomerGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Process payment for a booking' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Payment processed', type: dto_1.PaymentResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Booking not found' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Booking already paid' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreatePaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get payment by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment details', type: dto_1.PaymentResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('booking/:bookingId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get payment for a specific booking' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment details', type: dto_1.PaymentResponseDto }),
    __param(0, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "findByBooking", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(guards_1.CustomerGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get customer payment history' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of payments', type: [dto_1.PaymentResponseDto] }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.PaymentQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "findCustomerPayments", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('payments'),
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map