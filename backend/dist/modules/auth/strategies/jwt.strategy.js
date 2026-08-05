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
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const customer_entity_1 = require("../../customers/entities/customer.entity");
const service_provider_entity_1 = require("../../providers/entities/service-provider.entity");
const admin_entity_1 = require("../../admins/entities/admin.entity");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    constructor(configService, customerRepository, providerRepository, adminRepository) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_ACCESS_SECRET'),
        });
        this.configService = configService;
        this.customerRepository = customerRepository;
        this.providerRepository = providerRepository;
        this.adminRepository = adminRepository;
    }
    async validate(payload) {
        let user = null;
        switch (payload.userType) {
            case 'customer':
                user = await this.customerRepository.findOne({
                    where: { customerId: payload.sub },
                });
                if (!user || !user.isActive || user.isBlocked) {
                    throw new common_1.UnauthorizedException('User account is not active');
                }
                break;
            case 'provider':
                user = await this.providerRepository.findOne({
                    where: { providerId: payload.sub },
                });
                if (!user || !user.isActive || user.isBlocked) {
                    throw new common_1.UnauthorizedException('Provider account is not active');
                }
                break;
            case 'admin':
                user = await this.adminRepository.findOne({
                    where: { id: payload.sub },
                });
                if (!user || !user.isActive) {
                    throw new common_1.UnauthorizedException('Admin account is not active');
                }
                break;
            default:
                throw new common_1.UnauthorizedException('Invalid user type');
        }
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return {
            userId: payload.sub,
            email: payload.email,
            userType: payload.userType,
            user,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(customer_entity_1.Customer)),
    __param(2, (0, typeorm_1.InjectRepository)(service_provider_entity_1.ServiceProvider)),
    __param(3, (0, typeorm_1.InjectRepository)(admin_entity_1.Admin)),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object, typeof (_c = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _c : Object, typeof (_d = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _d : Object])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map