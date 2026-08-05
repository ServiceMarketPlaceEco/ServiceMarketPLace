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
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const admin_entity_1 = require("./entities/admin.entity");
const customer_entity_1 = require("../customers/entities/customer.entity");
const service_provider_entity_1 = require("../providers/entities/service-provider.entity");
const booking_entity_1 = require("../bookings/entities/booking.entity");
const payment_entity_1 = require("../payments/entities/payment.entity");
const review_entity_1 = require("../reviews/entities/review.entity");
const block_report_entity_1 = require("../reports/entities/block-report.entity");
let AdminsService = class AdminsService {
    constructor(adminRepository, customerRepository, providerRepository, bookingRepository, paymentRepository, reviewRepository, reportRepository) {
        this.adminRepository = adminRepository;
        this.customerRepository = customerRepository;
        this.providerRepository = providerRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.reviewRepository = reviewRepository;
        this.reportRepository = reportRepository;
    }
    async create(createAdminDto) {
        const existingAdmin = await this.adminRepository.findOne({
            where: { email: createAdminDto.email },
        });
        if (existingAdmin) {
            throw new common_1.ConflictException('Admin with this email already exists');
        }
        const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);
        const admin = this.adminRepository.create({
            name: createAdminDto.name,
            email: createAdminDto.email,
            passwordHash: hashedPassword,
            role: createAdminDto.role,
        });
        const savedAdmin = await this.adminRepository.save(admin);
        return savedAdmin;
    }
    async findAll() {
        return this.adminRepository.find({
            select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
        });
    }
    async findOne(id) {
        const admin = await this.adminRepository.findOne({
            where: { id },
            select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
        });
        if (!admin) {
            throw new common_1.NotFoundException('Admin not found');
        }
        return admin;
    }
    async findByEmail(email) {
        return this.adminRepository.findOne({
            where: { email },
        });
    }
    async update(id, updateAdminDto) {
        const admin = await this.findOne(id);
        if (updateAdminDto.email && updateAdminDto.email !== admin.email) {
            const existingAdmin = await this.adminRepository.findOne({
                where: { email: updateAdminDto.email },
            });
            if (existingAdmin) {
                throw new common_1.ConflictException('Email already in use');
            }
        }
        Object.assign(admin, updateAdminDto);
        return this.adminRepository.save(admin);
    }
    async deactivate(id) {
        const admin = await this.findOne(id);
        admin.isActive = false;
        return this.adminRepository.save(admin);
    }
    async activate(id) {
        const admin = await this.findOne(id);
        admin.isActive = true;
        return this.adminRepository.save(admin);
    }
    async getDashboardStats() {
        const [totalCustomers, totalProviders, totalBookings, pendingBookings, completedBookings, pendingReports,] = await Promise.all([
            this.customerRepository.count(),
            this.providerRepository.count(),
            this.bookingRepository.count(),
            this.bookingRepository.count({ where: { status: booking_entity_1.BookingStatus.PENDING } }),
            this.bookingRepository.count({ where: { status: booking_entity_1.BookingStatus.COMPLETED } }),
            this.reportRepository.count({ where: { status: block_report_entity_1.ReportStatus.PENDING } }),
        ]);
        const revenueResult = await this.paymentRepository
            .createQueryBuilder('payment')
            .select('SUM(payment.amount)', 'total')
            .where('payment.status = :status', { status: 'completed' })
            .getRawOne();
        const totalRevenue = parseFloat(revenueResult?.total || '0');
        const recentBookings = await this.bookingRepository.find({
            relations: ['customer', 'providerService'],
            order: { createdAt: 'DESC' },
            take: 10,
        });
        const recentReviews = await this.reviewRepository.find({
            relations: ['customer', 'provider'],
            order: { createdAt: 'DESC' },
            take: 10,
        });
        return {
            totalCustomers,
            totalProviders,
            totalBookings,
            pendingBookings,
            completedBookings,
            totalRevenue,
            pendingReports,
            recentBookings,
            recentReviews,
        };
    }
    async getAllCustomers(page = 1, limit = 10) {
        const [data, total] = await this.customerRepository.findAndCount({
            select: ['customerId', 'name', 'email', 'phone', 'isActive', 'createdAt'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { data, total };
    }
    async getAllProviders(page = 1, limit = 10) {
        const [data, total] = await this.providerRepository.findAndCount({
            select: [
                'providerId',
                'providerName',
                'email',
                'phone',
                'isActive',
                'isVerified',
                'rating',
                'createdAt',
            ],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { data, total };
    }
    async verifyProvider(providerId) {
        const provider = await this.providerRepository.findOne({
            where: { providerId: providerId },
        });
        if (!provider) {
            throw new common_1.NotFoundException('Provider not found');
        }
        provider.isVerified = true;
        provider.isActive = true;
        return this.providerRepository.save(provider);
    }
    async suspendUser(userType, userId, reason) {
        if (userType === 'customer') {
            const customer = await this.customerRepository.findOne({
                where: { customerId: userId },
            });
            if (!customer) {
                throw new common_1.NotFoundException('Customer not found');
            }
            customer.isBlocked = true;
            customer.isActive = false;
            await this.customerRepository.save(customer);
        }
        else {
            const provider = await this.providerRepository.findOne({
                where: { providerId: userId },
            });
            if (!provider) {
                throw new common_1.NotFoundException('Provider not found');
            }
            provider.isBlocked = true;
            provider.isActive = false;
            await this.providerRepository.save(provider);
        }
    }
    async activateUser(userType, userId) {
        if (userType === 'customer') {
            const customer = await this.customerRepository.findOne({
                where: { customerId: userId },
            });
            if (!customer) {
                throw new common_1.NotFoundException('Customer not found');
            }
            customer.isBlocked = false;
            customer.isActive = true;
            await this.customerRepository.save(customer);
        }
        else {
            const provider = await this.providerRepository.findOne({
                where: { providerId: userId },
            });
            if (!provider) {
                throw new common_1.NotFoundException('Provider not found');
            }
            provider.isBlocked = false;
            provider.isActive = true;
            await this.providerRepository.save(provider);
        }
    }
};
exports.AdminsService = AdminsService;
exports.AdminsService = AdminsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(admin_entity_1.Admin)),
    __param(1, (0, typeorm_1.InjectRepository)(customer_entity_1.Customer)),
    __param(2, (0, typeorm_1.InjectRepository)(service_provider_entity_1.ServiceProvider)),
    __param(3, (0, typeorm_1.InjectRepository)(booking_entity_1.Booking)),
    __param(4, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(5, (0, typeorm_1.InjectRepository)(review_entity_1.Review)),
    __param(6, (0, typeorm_1.InjectRepository)(block_report_entity_1.BlockReport)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object, typeof (_c = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _c : Object, typeof (_d = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _d : Object, typeof (_e = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _e : Object, typeof (_f = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _f : Object, typeof (_g = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _g : Object])
], AdminsService);
//# sourceMappingURL=admins.service.js.map