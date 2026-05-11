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
exports.ServiceProvider = void 0;
const typeorm_1 = require("typeorm");
const class_transformer_1 = require("class-transformer");
const provider_service_entity_1 = require("./provider-service.entity");
const review_entity_1 = require("../../reviews/entities/review.entity");
let ServiceProvider = class ServiceProvider {
};
exports.ServiceProvider = ServiceProvider;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'provider_id' }),
    __metadata("design:type", String)
], ServiceProvider.prototype, "providerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_name', length: 255 }),
    __metadata("design:type", String)
], ServiceProvider.prototype, "providerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true, length: 255 }),
    __metadata("design:type", String)
], ServiceProvider.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'password_hash', length: 255 }),
    (0, class_transformer_1.Exclude)(),
    __metadata("design:type", String)
], ServiceProvider.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ABN', nullable: true }),
    __metadata("design:type", Number)
], ServiceProvider.prototype, "abn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ServiceProvider.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'postal_code', nullable: true }),
    __metadata("design:type", Number)
], ServiceProvider.prototype, "postalCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ServiceProvider.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ServiceProvider.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'profile_image', nullable: true, length: 500 }),
    __metadata("design:type", String)
], ServiceProvider.prototype, "profileImage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 3, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ServiceProvider.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_reviews', default: 0 }),
    __metadata("design:type", Number)
], ServiceProvider.prototype, "totalReviews", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_verified', default: false }),
    __metadata("design:type", Boolean)
], ServiceProvider.prototype, "isVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', default: true }),
    __metadata("design:type", Boolean)
], ServiceProvider.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_blocked', default: false }),
    __metadata("design:type", Boolean)
], ServiceProvider.prototype, "isBlocked", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ServiceProvider.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ServiceProvider.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => provider_service_entity_1.ProviderService, (ps) => ps.provider),
    __metadata("design:type", Array)
], ServiceProvider.prototype, "providerServices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => review_entity_1.Review, (review) => review.provider),
    __metadata("design:type", Array)
], ServiceProvider.prototype, "reviews", void 0);
exports.ServiceProvider = ServiceProvider = __decorate([
    (0, typeorm_1.Entity)('service_providers')
], ServiceProvider);
//# sourceMappingURL=service-provider.entity.js.map