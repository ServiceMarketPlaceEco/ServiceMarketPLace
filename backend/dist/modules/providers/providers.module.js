"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvidersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const providers_controller_1 = require("./providers.controller");
const providers_service_1 = require("./providers.service");
const service_provider_entity_1 = require("./entities/service-provider.entity");
const provider_service_entity_1 = require("./entities/provider-service.entity");
const bookings_module_1 = require("../bookings/bookings.module");
let ProvidersModule = class ProvidersModule {
};
exports.ProvidersModule = ProvidersModule;
exports.ProvidersModule = ProvidersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([service_provider_entity_1.ServiceProvider, provider_service_entity_1.ProviderService]),
            (0, common_1.forwardRef)(() => bookings_module_1.BookingsModule),
        ],
        controllers: [providers_controller_1.ProvidersController],
        providers: [providers_service_1.ProvidersService],
        exports: [providers_service_1.ProvidersService],
    })
], ProvidersModule);
//# sourceMappingURL=providers.module.js.map