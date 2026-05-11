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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const uuid_1 = require("uuid");
const customer_entity_1 = require("../customers/entities/customer.entity");
const service_provider_entity_1 = require("../providers/entities/service-provider.entity");
const admin_entity_1 = require("../admins/entities/admin.entity");
const refresh_token_entity_1 = require("./entities/refresh-token.entity");
const dto_1 = require("./dto");
const mail_service_1 = require("../mail/mail.service");
let AuthService = class AuthService {
    constructor(customerRepository, providerRepository, adminRepository, refreshTokenRepository, jwtService, configService, mailService) {
        this.customerRepository = customerRepository;
        this.providerRepository = providerRepository;
        this.adminRepository = adminRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.configService = configService;
        this.mailService = mailService;
    }
    async registerCustomer(dto) {
        const existingCustomer = await this.customerRepository.findOne({
            where: { email: dto.email },
        });
        if (existingCustomer) {
            throw new common_1.ConflictException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const customer = this.customerRepository.create({
            name: dto.name,
            email: dto.email,
            passwordHash,
            age: dto.age,
            phone: dto.phone,
            address: dto.address,
        });
        await this.customerRepository.save(customer);
        await this.mailService.sendWelcomeEmail(customer.email, customer.name);
        return this.generateTokens(customer.customerId, customer.email, 'customer', customer);
    }
    async registerProvider(dto) {
        const existingProvider = await this.providerRepository.findOne({
            where: { email: dto.email },
        });
        if (existingProvider) {
            throw new common_1.ConflictException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const provider = this.providerRepository.create({
            providerName: dto.providerName,
            email: dto.email,
            passwordHash,
            abn: dto.abn,
            address: dto.address,
            postalCode: dto.postalCode,
            phone: dto.phone,
            description: dto.description,
        });
        await this.providerRepository.save(provider);
        await this.mailService.sendProviderWelcomeEmail(provider.email, provider.providerName);
        return this.generateTokens(provider.providerId, provider.email, 'provider', provider);
    }
    async login(dto) {
        let user = null;
        let userId;
        let userType;
        switch (dto.userType) {
            case dto_1.UserTypeDto.CUSTOMER:
                user = await this.customerRepository.findOne({
                    where: { email: dto.email },
                });
                if (user) {
                    userId = user.customerId;
                    userType = refresh_token_entity_1.UserType.CUSTOMER;
                    if (user.isBlocked) {
                        throw new common_1.UnauthorizedException('Your account has been blocked');
                    }
                    if (!user.isActive) {
                        throw new common_1.UnauthorizedException('Your account is not active');
                    }
                }
                break;
            case dto_1.UserTypeDto.PROVIDER:
                user = await this.providerRepository.findOne({
                    where: { email: dto.email },
                });
                if (user) {
                    userId = user.providerId;
                    userType = refresh_token_entity_1.UserType.PROVIDER;
                    if (user.isBlocked) {
                        throw new common_1.UnauthorizedException('Your account has been blocked');
                    }
                    if (!user.isActive) {
                        throw new common_1.UnauthorizedException('Your account is not active');
                    }
                }
                break;
            case dto_1.UserTypeDto.ADMIN:
                user = await this.adminRepository.findOne({
                    where: { email: dto.email },
                });
                if (user) {
                    userId = user.id;
                    userType = refresh_token_entity_1.UserType.ADMIN;
                    if (!user.isActive) {
                        throw new common_1.UnauthorizedException('Your account is not active');
                    }
                }
                break;
            default:
                throw new common_1.BadRequestException('Invalid user type');
        }
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return this.generateTokens(userId, user.email, userType, user);
    }
    async refreshToken(refreshToken) {
        const storedToken = await this.refreshTokenRepository.findOne({
            where: {
                token: refreshToken,
                expiresAt: (0, typeorm_2.MoreThan)(new Date()),
            },
        });
        if (!storedToken) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        await this.refreshTokenRepository.remove(storedToken);
        let user = null;
        let userId = storedToken.userId;
        switch (storedToken.userType) {
            case refresh_token_entity_1.UserType.CUSTOMER:
                user = await this.customerRepository.findOne({
                    where: { customerId: storedToken.userId },
                });
                break;
            case refresh_token_entity_1.UserType.PROVIDER:
                user = await this.providerRepository.findOne({
                    where: { providerId: storedToken.userId },
                });
                break;
            case refresh_token_entity_1.UserType.ADMIN:
                user = await this.adminRepository.findOne({
                    where: { id: storedToken.userId },
                });
                break;
        }
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return this.generateTokens(userId, user.email, storedToken.userType, user);
    }
    async logout(refreshToken) {
        await this.refreshTokenRepository.delete({ token: refreshToken });
    }
    async forgotPassword(email, userType) {
        let user = null;
        let userId;
        let userName;
        switch (userType) {
            case dto_1.UserTypeDto.CUSTOMER:
                user = await this.customerRepository.findOne({ where: { email } });
                if (user) {
                    userId = user.customerId;
                    userName = user.name;
                }
                break;
            case dto_1.UserTypeDto.PROVIDER:
                user = await this.providerRepository.findOne({ where: { email } });
                if (user) {
                    userId = user.providerId;
                    userName = user.providerName;
                }
                break;
            case dto_1.UserTypeDto.ADMIN:
                user = await this.adminRepository.findOne({ where: { email } });
                if (user) {
                    userId = user.id;
                    userName = user.name;
                }
                break;
        }
        if (!user) {
            return;
        }
        const resetToken = this.jwtService.sign({ sub: userId, email, userType }, {
            secret: this.configService.get('JWT_ACCESS_SECRET'),
            expiresIn: '1h',
        });
        await this.mailService.sendPasswordResetEmail(email, userName, resetToken);
    }
    async resetPassword(token, newPassword) {
        try {
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_ACCESS_SECRET'),
            });
            const passwordHash = await bcrypt.hash(newPassword, 10);
            switch (payload.userType) {
                case 'customer':
                    await this.customerRepository.update({ customerId: payload.sub }, { passwordHash });
                    break;
                case 'provider':
                    await this.providerRepository.update({ providerId: payload.sub }, { passwordHash });
                    break;
                case 'admin':
                    await this.adminRepository.update({ id: payload.sub }, { passwordHash });
                    break;
                default:
                    throw new common_1.BadRequestException('Invalid user type');
            }
        }
        catch (error) {
            throw new common_1.BadRequestException('Invalid or expired reset token');
        }
    }
    async generateTokens(userId, email, userType, user) {
        const payload = { sub: userId, email, userType };
        const accessToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_ACCESS_SECRET'),
            expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', '15m'),
        });
        const refreshToken = (0, uuid_1.v4)();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const tokenEntity = this.refreshTokenRepository.create({
            userId,
            userType: userType,
            token: refreshToken,
            expiresAt,
        });
        await this.refreshTokenRepository.save(tokenEntity);
        const { passwordHash, ...userWithoutPassword } = user;
        return {
            accessToken,
            refreshToken,
            user: userWithoutPassword,
            userType: userType.toString(),
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(customer_entity_1.Customer)),
    __param(1, (0, typeorm_1.InjectRepository)(service_provider_entity_1.ServiceProvider)),
    __param(2, (0, typeorm_1.InjectRepository)(admin_entity_1.Admin)),
    __param(3, (0, typeorm_1.InjectRepository)(refresh_token_entity_1.RefreshToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        config_1.ConfigService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map