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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const payment_entity_1 = require("./entities/payment.entity");
const booking_entity_1 = require("../bookings/entities/booking.entity");
const mail_service_1 = require("../mail/mail.service");
let PaymentsService = class PaymentsService {
    constructor(paymentRepository, bookingRepository, mailService) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.mailService = mailService;
    }
    async create(customerId, dto) {
        const booking = await this.bookingRepository.findOne({
            where: { bookingId: dto.bookingId },
            relations: ['providerService', 'providerService.provider', 'providerService.service', 'customer'],
        });
        if (!booking) {
            throw new common_1.NotFoundException('Booking not found');
        }
        if (booking.customerId !== customerId) {
            throw new common_1.ForbiddenException('You can only pay for your own bookings');
        }
        const existingPayment = await this.paymentRepository.findOne({
            where: { bookingId: dto.bookingId, status: payment_entity_1.PaymentStatus.COMPLETED },
        });
        if (existingPayment) {
            throw new common_1.BadRequestException('Booking already paid');
        }
        const payment = this.paymentRepository.create({
            bookingId: dto.bookingId,
            customerId,
            amount: dto.amount,
            paymentMethod: dto.paymentMethod,
            transactionId: dto.transactionId,
            status: payment_entity_1.PaymentStatus.COMPLETED,
            paymentDate: new Date(),
        });
        const savedPayment = await this.paymentRepository.save(payment);
        booking.paymentId = savedPayment.paymentId;
        await this.bookingRepository.save(booking);
        await this.mailService.sendPaymentConfirmation(savedPayment, booking);
        return savedPayment;
    }
    async findById(paymentId) {
        const payment = await this.paymentRepository.findOne({
            where: { paymentId },
            relations: ['customer', 'booking'],
        });
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        return payment;
    }
    async findByBooking(bookingId) {
        return this.paymentRepository.findOne({
            where: { bookingId },
        });
    }
    async findByCustomer(customerId, query) {
        const where = { customerId };
        if (query?.status) {
            where.status = query.status;
        }
        if (query?.fromDate && query?.toDate) {
            where.paymentDate = (0, typeorm_2.Between)(new Date(query.fromDate), new Date(query.toDate));
        }
        else if (query?.fromDate) {
            where.paymentDate = (0, typeorm_2.MoreThanOrEqual)(new Date(query.fromDate));
        }
        else if (query?.toDate) {
            where.paymentDate = (0, typeorm_2.LessThanOrEqual)(new Date(query.toDate));
        }
        return this.paymentRepository.find({
            where,
            relations: ['booking'],
            order: { paymentDate: 'DESC' },
        });
    }
    async findAll(query) {
        const where = {};
        if (query?.status) {
            where.status = query.status;
        }
        if (query?.fromDate && query?.toDate) {
            where.paymentDate = (0, typeorm_2.Between)(new Date(query.fromDate), new Date(query.toDate));
        }
        return this.paymentRepository.find({
            where,
            relations: ['customer', 'booking'],
            order: { createdAt: 'DESC' },
        });
    }
    async refund(paymentId) {
        const payment = await this.findById(paymentId);
        if (payment.status !== payment_entity_1.PaymentStatus.COMPLETED) {
            throw new common_1.BadRequestException('Can only refund completed payments');
        }
        payment.status = payment_entity_1.PaymentStatus.REFUNDED;
        return this.paymentRepository.save(payment);
    }
    async getStats() {
        const total = await this.paymentRepository.count();
        const completed = await this.paymentRepository.count({ where: { status: payment_entity_1.PaymentStatus.COMPLETED } });
        const refunded = await this.paymentRepository.count({ where: { status: payment_entity_1.PaymentStatus.REFUNDED } });
        const totalAmount = await this.paymentRepository
            .createQueryBuilder('payment')
            .where('payment.status = :status', { status: payment_entity_1.PaymentStatus.COMPLETED })
            .select('SUM(payment.amount)', 'total')
            .getRawOne();
        return {
            total,
            completed,
            refunded,
            totalRevenue: totalAmount?.total || 0,
        };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(1, (0, typeorm_1.InjectRepository)(booking_entity_1.Booking)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object, mail_service_1.MailService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map