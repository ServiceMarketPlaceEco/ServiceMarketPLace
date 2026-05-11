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
exports.ProvidersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const service_provider_entity_1 = require("./entities/service-provider.entity");
const provider_service_entity_1 = require("./entities/provider-service.entity");
let ProvidersService = class ProvidersService {
    constructor(providerRepository, providerServiceRepository) {
        this.providerRepository = providerRepository;
        this.providerServiceRepository = providerServiceRepository;
    }
    async findAll(query) {
        const where = { isActive: true, isBlocked: false };
        if (query.verified !== undefined) {
            where.isVerified = query.verified;
        }
        if (query.minRating) {
            where.rating = (0, typeorm_2.MoreThanOrEqual)(query.minRating);
        }
        if (query.search) {
            where.providerName = (0, typeorm_2.Like)(`%${query.search}%`);
        }
        let providers = await this.providerRepository.find({
            where,
            select: [
                'providerId',
                'providerName',
                'address',
                'description',
                'profileImage',
                'rating',
                'totalReviews',
                'isVerified',
            ],
            order: { rating: 'DESC' },
        });
        if (query.serviceId) {
            const providerServices = await this.providerServiceRepository.find({
                where: { serviceId: query.serviceId, isAvailable: true },
                select: ['providerId'],
            });
            const providerIds = providerServices.map((ps) => ps.providerId);
            providers = providers.filter((p) => providerIds.includes(p.providerId));
        }
        return providers;
    }
    async findById(providerId) {
        const provider = await this.providerRepository.findOne({
            where: { providerId },
            relations: ['providerServices', 'providerServices.service'],
        });
        if (!provider) {
            throw new common_1.NotFoundException('Provider not found');
        }
        return provider;
    }
    async getPublicProfile(providerId) {
        const provider = await this.providerRepository.findOne({
            where: { providerId, isActive: true, isBlocked: false },
            select: [
                'providerId',
                'providerName',
                'address',
                'postalCode',
                'description',
                'profileImage',
                'rating',
                'totalReviews',
                'isVerified',
                'createdAt',
            ],
            relations: ['providerServices', 'providerServices.service'],
        });
        if (!provider) {
            throw new common_1.NotFoundException('Provider not found');
        }
        const services = provider.providerServices
            .filter((ps) => ps.isAvailable)
            .map((ps) => ({
            id: ps.id,
            serviceId: ps.serviceId,
            serviceName: ps.service.serviceName,
            price: ps.price,
            description: ps.description,
        }));
        const { providerServices, ...providerData } = provider;
        return { ...providerData, services };
    }
    async getProfile(providerId) {
        return this.findById(providerId);
    }
    async updateProfile(providerId, dto) {
        const provider = await this.findById(providerId);
        Object.assign(provider, dto);
        return this.providerRepository.save(provider);
    }
    async changePassword(providerId, dto) {
        const provider = await this.providerRepository.findOne({
            where: { providerId },
            select: ['providerId', 'passwordHash'],
        });
        if (!provider) {
            throw new common_1.NotFoundException('Provider not found');
        }
        const isPasswordValid = await bcrypt.compare(dto.currentPassword, provider.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        provider.passwordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.providerRepository.save(provider);
    }
    async addService(providerId, dto) {
        const existing = await this.providerServiceRepository.findOne({
            where: { providerId, serviceId: dto.serviceId },
        });
        if (existing) {
            throw new common_1.ConflictException('Already offering this service');
        }
        const providerService = this.providerServiceRepository.create({
            providerId,
            serviceId: dto.serviceId,
            price: dto.price,
            description: dto.description,
        });
        return this.providerServiceRepository.save(providerService);
    }
    async updateService(providerId, serviceId, dto) {
        const providerService = await this.providerServiceRepository.findOne({
            where: { id: serviceId, providerId },
        });
        if (!providerService) {
            throw new common_1.NotFoundException('Service offering not found');
        }
        Object.assign(providerService, dto);
        return this.providerServiceRepository.save(providerService);
    }
    async removeService(providerId, serviceId) {
        const providerService = await this.providerServiceRepository.findOne({
            where: { id: serviceId, providerId },
        });
        if (!providerService) {
            throw new common_1.NotFoundException('Service offering not found');
        }
        await this.providerServiceRepository.remove(providerService);
    }
    async getServices(providerId) {
        return this.providerServiceRepository.find({
            where: { providerId },
            relations: ['service'],
        });
    }
    async findAllAdmin() {
        return this.providerRepository.find({
            select: [
                'providerId',
                'providerName',
                'email',
                'abn',
                'address',
                'phone',
                'rating',
                'totalReviews',
                'isVerified',
                'isActive',
                'isBlocked',
                'createdAt',
            ],
            order: { createdAt: 'DESC' },
        });
    }
    async verifyProvider(providerId, verify) {
        const provider = await this.findById(providerId);
        provider.isVerified = verify;
        return this.providerRepository.save(provider);
    }
    async blockProvider(providerId, block) {
        const provider = await this.findById(providerId);
        provider.isBlocked = block;
        return this.providerRepository.save(provider);
    }
    async updateRating(providerId, newRating, totalReviews) {
        await this.providerRepository.update(providerId, {
            rating: newRating,
            totalReviews,
        });
    }
};
exports.ProvidersService = ProvidersService;
exports.ProvidersService = ProvidersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(service_provider_entity_1.ServiceProvider)),
    __param(1, (0, typeorm_1.InjectRepository)(provider_service_entity_1.ProviderService)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ProvidersService);
//# sourceMappingURL=providers.service.js.map