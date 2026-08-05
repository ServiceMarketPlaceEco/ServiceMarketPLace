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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const customer_entity_1 = require("./entities/customer.entity");
let CustomersService = class CustomersService {
    constructor(customerRepository) {
        this.customerRepository = customerRepository;
    }
    async findById(customerId) {
        const customer = await this.customerRepository.findOne({
            where: { customerId },
        });
        if (!customer) {
            throw new common_1.NotFoundException('Customer not found');
        }
        return customer;
    }
    async findByEmail(email) {
        return this.customerRepository.findOne({ where: { email } });
    }
    async getProfile(customerId) {
        const customer = await this.customerRepository.findOne({
            where: { customerId },
            select: ['customerId', 'name', 'email', 'age', 'phone', 'address', 'profileImage', 'createdAt'],
        });
        if (!customer) {
            throw new common_1.NotFoundException('Customer not found');
        }
        return customer;
    }
    async updateProfile(customerId, dto) {
        const customer = await this.findById(customerId);
        Object.assign(customer, dto);
        return this.customerRepository.save(customer);
    }
    async changePassword(customerId, dto) {
        const customer = await this.customerRepository.findOne({
            where: { customerId },
            select: ['customerId', 'passwordHash'],
        });
        if (!customer) {
            throw new common_1.NotFoundException('Customer not found');
        }
        const isPasswordValid = await bcrypt.compare(dto.currentPassword, customer.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        customer.passwordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.customerRepository.save(customer);
    }
    async deactivateAccount(customerId) {
        const customer = await this.findById(customerId);
        customer.isActive = false;
        await this.customerRepository.save(customer);
    }
    async findAll() {
        return this.customerRepository.find({
            select: ['customerId', 'name', 'email', 'age', 'phone', 'isActive', 'isBlocked', 'createdAt'],
            order: { createdAt: 'DESC' },
        });
    }
    async blockCustomer(customerId, block) {
        const customer = await this.findById(customerId);
        customer.isBlocked = block;
        return this.customerRepository.save(customer);
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(customer_entity_1.Customer)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object])
], CustomersService);
//# sourceMappingURL=customers.service.js.map