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
exports.ServicesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const service_entity_1 = require("./entities/service.entity");
let ServicesService = class ServicesService {
    constructor(serviceRepository) {
        this.serviceRepository = serviceRepository;
    }
    async findAll() {
        return this.serviceRepository.find({
            where: { isActive: true },
            order: { serviceName: 'ASC' },
        });
    }
    async findAllAdmin() {
        return this.serviceRepository.find({
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const service = await this.serviceRepository.findOne({
            where: { serviceId: id },
        });
        if (!service) {
            throw new common_1.NotFoundException('Service not found');
        }
        return service;
    }
    async findProvidersForService(serviceId) {
        const service = await this.serviceRepository.findOne({
            where: { serviceId, isActive: true },
            relations: ['providerServices', 'providerServices.provider'],
        });
        if (!service) {
            throw new common_1.NotFoundException('Service not found');
        }
        return service.providerServices
            .filter((ps) => ps.isAvailable && ps.provider.isActive && !ps.provider.isBlocked)
            .map((ps) => ({
            providerId: ps.provider.providerId,
            providerName: ps.provider.providerName,
            description: ps.provider.description,
            address: ps.provider.address,
            rating: ps.provider.rating,
            totalReviews: ps.provider.totalReviews,
            isVerified: ps.provider.isVerified,
            profileImage: ps.provider.profileImage,
            price: ps.price,
            serviceDescription: ps.description,
        }));
    }
    async create(dto) {
        const service = this.serviceRepository.create(dto);
        return this.serviceRepository.save(service);
    }
    async update(id, dto) {
        const service = await this.findOne(id);
        Object.assign(service, dto);
        return this.serviceRepository.save(service);
    }
    async remove(id) {
        const service = await this.findOne(id);
        await this.serviceRepository.remove(service);
    }
};
exports.ServicesService = ServicesService;
exports.ServicesService = ServicesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(service_entity_1.Service)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object])
], ServicesService);
//# sourceMappingURL=services.service.js.map