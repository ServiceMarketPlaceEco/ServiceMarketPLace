import { ProvidersService } from './providers.service';
import { UpdateProviderProfileDto, AddProviderServiceDto, UpdateProviderServiceDto, UpdateBookingStatusDto, ProviderListQueryDto } from './dto';
import { ChangePasswordDto } from '../customers/dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { BookingsService } from '../bookings/bookings.service';
export declare class ProvidersController {
    private readonly providersService;
    private readonly bookingsService;
    constructor(providersService: ProvidersService, bookingsService: BookingsService);
    findAll(query: ProviderListQueryDto): Promise<import("./entities/service-provider.entity").ServiceProvider[]>;
    findOne(id: string): Promise<any>;
    getProfile(user: CurrentUserData): Promise<import("./entities/service-provider.entity").ServiceProvider>;
    updateProfile(user: CurrentUserData, dto: UpdateProviderProfileDto): Promise<import("./entities/service-provider.entity").ServiceProvider>;
    changePassword(user: CurrentUserData, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    getServices(user: CurrentUserData): Promise<import("./entities/provider-service.entity").ProviderService[]>;
    addService(user: CurrentUserData, dto: AddProviderServiceDto): Promise<import("./entities/provider-service.entity").ProviderService>;
    updateService(user: CurrentUserData, serviceId: string, dto: UpdateProviderServiceDto): Promise<import("./entities/provider-service.entity").ProviderService>;
    removeService(user: CurrentUserData, serviceId: string): Promise<{
        message: string;
    }>;
    getBookings(user: CurrentUserData): Promise<import("../bookings/entities/booking.entity").Booking[]>;
    updateBookingStatus(user: CurrentUserData, bookingId: string, dto: UpdateBookingStatusDto): Promise<import("../bookings/entities/booking.entity").Booking>;
}
