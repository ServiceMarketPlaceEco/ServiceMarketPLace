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
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const booking_entity_1 = require("./entities/booking.entity");
const provider_service_entity_1 = require("../providers/entities/provider-service.entity");
const mail_service_1 = require("../mail/mail.service");
let BookingsService = class BookingsService {
    constructor(bookingRepository, providerServiceRepository, mailService) {
        this.bookingRepository = bookingRepository;
        this.providerServiceRepository = providerServiceRepository;
        this.mailService = mailService;
    }
    async create(customerId, dto) {
        const providerService = await this.providerServiceRepository.findOne({
            where: { id: dto.providerServiceId, isAvailable: true },
            relations: ['provider', 'service'],
        });
        if (!providerService) {
            throw new common_1.NotFoundException('Service not available');
        }
        if (providerService.provider.isBlocked || !providerService.provider.isActive) {
            throw new common_1.BadRequestException('Provider is not available');
        }
        const booking = this.bookingRepository.create({
            customerId,
            providerServiceId: dto.providerServiceId,
            date: new Date(dto.date),
            time: dto.time,
            notes: dto.notes,
            address: dto.address,
            totalAmount: providerService.price,
            status: booking_entity_1.BookingStatus.PENDING,
        });
        const savedBooking = await this.bookingRepository.save(booking);
        await this.mailService.sendBookingConfirmation(savedBooking, providerService.provider, providerService.service);
        return savedBooking;
    }
    async findById(bookingId) {
        const booking = await this.bookingRepository.findOne({
            where: { bookingId },
            relations: ['customer', 'providerService', 'providerService.provider', 'providerService.service'],
        });
        if (!booking) {
            throw new common_1.NotFoundException('Booking not found');
        }
        return booking;
    }
    async findByCustomer(customerId, query) {
        const where = { customerId };
        if (query?.status) {
            where.status = query.status;
        }
        if (query?.fromDate && query?.toDate) {
            where.date = (0, typeorm_2.Between)(new Date(query.fromDate), new Date(query.toDate));
        }
        else if (query?.fromDate) {
            where.date = (0, typeorm_2.MoreThanOrEqual)(new Date(query.fromDate));
        }
        else if (query?.toDate) {
            where.date = (0, typeorm_2.LessThanOrEqual)(new Date(query.toDate));
        }
        return this.bookingRepository.find({
            where,
            relations: ['providerService', 'providerService.provider', 'providerService.service'],
            order: { date: 'DESC', time: 'DESC' },
        });
    }
    async findByProvider(providerId, query) {
        const providerServices = await this.providerServiceRepository.find({
            where: { providerId },
            select: ['id'],
        });
        const serviceIds = providerServices.map((ps) => ps.id);
        if (serviceIds.length === 0) {
            return [];
        }
        const qb = this.bookingRepository
            .createQueryBuilder('booking')
            .leftJoinAndSelect('booking.customer', 'customer')
            .leftJoinAndSelect('booking.providerService', 'providerService')
            .leftJoinAndSelect('providerService.service', 'service')
            .where('booking.providerServiceId IN (:...serviceIds)', { serviceIds });
        if (query?.status) {
            qb.andWhere('booking.status = :status', { status: query.status });
        }
        if (query?.fromDate) {
            qb.andWhere('booking.date >= :fromDate', { fromDate: query.fromDate });
        }
        if (query?.toDate) {
            qb.andWhere('booking.date <= :toDate', { toDate: query.toDate });
        }
        return qb.orderBy('booking.date', 'DESC').addOrderBy('booking.time', 'DESC').getMany();
    }
    async update(customerId, bookingId, dto) {
        const booking = await this.findById(bookingId);
        if (booking.customerId !== customerId) {
            throw new common_1.ForbiddenException('You can only update your own bookings');
        }
        if (booking.status !== booking_entity_1.BookingStatus.PENDING) {
            throw new common_1.BadRequestException('Can only update pending bookings');
        }
        if (dto.date) {
            booking.date = new Date(dto.date);
        }
        if (dto.time) {
            booking.time = dto.time;
        }
        if (dto.notes !== undefined) {
            booking.notes = dto.notes;
        }
        if (dto.address !== undefined) {
            booking.address = dto.address;
        }
        return this.bookingRepository.save(booking);
    }
    async cancel(customerId, bookingId) {
        const booking = await this.findById(bookingId);
        if (booking.customerId !== customerId) {
            throw new common_1.ForbiddenException('You can only cancel your own bookings');
        }
        if ([booking_entity_1.BookingStatus.COMPLETED, booking_entity_1.BookingStatus.CANCELLED].includes(booking.status)) {
            throw new common_1.BadRequestException('Cannot cancel this booking');
        }
        booking.status = booking_entity_1.BookingStatus.CANCELLED;
        const cancelledBooking = await this.bookingRepository.save(booking);
        await this.mailService.sendBookingCancellation(cancelledBooking);
        return cancelledBooking;
    }
    async updateStatusByProvider(providerId, bookingId, status) {
        const booking = await this.findById(bookingId);
        if (booking.providerService.providerId !== providerId) {
            throw new common_1.ForbiddenException('You can only update your own bookings');
        }
        const validTransitions = {
            [booking_entity_1.BookingStatus.PENDING]: [booking_entity_1.BookingStatus.CONFIRMED, booking_entity_1.BookingStatus.CANCELLED],
            [booking_entity_1.BookingStatus.CONFIRMED]: [booking_entity_1.BookingStatus.IN_PROGRESS, booking_entity_1.BookingStatus.CANCELLED],
            [booking_entity_1.BookingStatus.IN_PROGRESS]: [booking_entity_1.BookingStatus.COMPLETED, booking_entity_1.BookingStatus.CANCELLED],
            [booking_entity_1.BookingStatus.COMPLETED]: [],
            [booking_entity_1.BookingStatus.CANCELLED]: [],
        };
        const newStatus = status;
        if (!validTransitions[booking.status].includes(newStatus)) {
            throw new common_1.BadRequestException(`Cannot transition from ${booking.status} to ${status}`);
        }
        booking.status = newStatus;
        const updatedBooking = await this.bookingRepository.save(booking);
        await this.mailService.sendBookingStatusUpdate(updatedBooking, newStatus);
        return updatedBooking;
    }
    async findAll(query) {
        const where = {};
        if (query?.status) {
            where.status = query.status;
        }
        if (query?.fromDate && query?.toDate) {
            where.date = (0, typeorm_2.Between)(new Date(query.fromDate), new Date(query.toDate));
        }
        return this.bookingRepository.find({
            where,
            relations: ['customer', 'providerService', 'providerService.provider', 'providerService.service'],
            order: { createdAt: 'DESC' },
        });
    }
    async getStats() {
        const total = await this.bookingRepository.count();
        const pending = await this.bookingRepository.count({ where: { status: booking_entity_1.BookingStatus.PENDING } });
        const confirmed = await this.bookingRepository.count({ where: { status: booking_entity_1.BookingStatus.CONFIRMED } });
        const inProgress = await this.bookingRepository.count({ where: { status: booking_entity_1.BookingStatus.IN_PROGRESS } });
        const completed = await this.bookingRepository.count({ where: { status: booking_entity_1.BookingStatus.COMPLETED } });
        const cancelled = await this.bookingRepository.count({ where: { status: booking_entity_1.BookingStatus.CANCELLED } });
        return { total, pending, confirmed, inProgress, completed, cancelled };
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(booking_entity_1.Booking)),
    __param(1, (0, typeorm_1.InjectRepository)(provider_service_entity_1.ProviderService)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        mail_service_1.MailService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map