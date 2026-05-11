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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminGuard = exports.ProviderGuard = exports.CustomerGuard = exports.UserTypeGuard = exports.RolesGuard = exports.UserTypes = exports.USER_TYPES_KEY = exports.Roles = exports.ROLES_KEY = exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const core_1 = require("@nestjs/core");
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)()
], JwtAuthGuard);
exports.ROLES_KEY = 'roles';
const Roles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.Roles = Roles;
exports.USER_TYPES_KEY = 'userTypes';
const UserTypes = (...userTypes) => (0, common_1.SetMetadata)(exports.USER_TYPES_KEY, userTypes);
exports.UserTypes = UserTypes;
let RolesGuard = class RolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const requiredRoles = this.reflector.getAllAndOverride(exports.ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredRoles) {
            return true;
        }
        const { user } = context.switchToHttp().getRequest();
        return requiredRoles.some((role) => user.user?.role === role);
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
let UserTypeGuard = class UserTypeGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const requiredTypes = this.reflector.getAllAndOverride(exports.USER_TYPES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredTypes) {
            return true;
        }
        const { user } = context.switchToHttp().getRequest();
        return requiredTypes.some((type) => user.userType === type);
    }
};
exports.UserTypeGuard = UserTypeGuard;
exports.UserTypeGuard = UserTypeGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], UserTypeGuard);
let CustomerGuard = class CustomerGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const { user } = context.switchToHttp().getRequest();
        return user && user.userType === 'customer';
    }
};
exports.CustomerGuard = CustomerGuard;
exports.CustomerGuard = CustomerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], CustomerGuard);
let ProviderGuard = class ProviderGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const { user } = context.switchToHttp().getRequest();
        return user && user.userType === 'provider';
    }
};
exports.ProviderGuard = ProviderGuard;
exports.ProviderGuard = ProviderGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], ProviderGuard);
let AdminGuard = class AdminGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const { user } = context.switchToHttp().getRequest();
        return user && user.userType === 'admin';
    }
};
exports.AdminGuard = AdminGuard;
exports.AdminGuard = AdminGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], AdminGuard);
//# sourceMappingURL=index.js.map