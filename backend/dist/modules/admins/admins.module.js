"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admins_service_1 = require("./admins.service");
const admins_controller_1 = require("./admins.controller");
const admin_entity_1 = require("./entities/admin.entity");
const customer_entity_1 = require("../customers/entities/customer.entity");
const service_provider_entity_1 = require("../providers/entities/service-provider.entity");
const booking_entity_1 = require("../bookings/entities/booking.entity");
const payment_entity_1 = require("../payments/entities/payment.entity");
const review_entity_1 = require("../reviews/entities/review.entity");
const block_report_entity_1 = require("../reports/entities/block-report.entity");
let AdminsModule = class AdminsModule {
};
exports.AdminsModule = AdminsModule;
exports.AdminsModule = AdminsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                admin_entity_1.Admin,
                customer_entity_1.Customer,
                service_provider_entity_1.ServiceProvider,
                booking_entity_1.Booking,
                payment_entity_1.Payment,
                review_entity_1.Review,
                block_report_entity_1.BlockReport,
            ]),
        ],
        controllers: [admins_controller_1.AdminsController],
        providers: [admins_service_1.AdminsService],
        exports: [admins_service_1.AdminsService],
    })
], AdminsModule);
//# sourceMappingURL=admins.module.js.map