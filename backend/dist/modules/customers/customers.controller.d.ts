import { CustomersService } from './customers.service';
import { UpdateCustomerProfileDto, ChangePasswordDto } from './dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { BookingsService } from '../bookings/bookings.service';
export declare class CustomersController {
    private readonly customersService;
    private readonly bookingsService;
    constructor(customersService: CustomersService, bookingsService: BookingsService);
    getProfile(user: CurrentUserData): Promise<import("./entities/customer.entity").Customer>;
    updateProfile(user: CurrentUserData, dto: UpdateCustomerProfileDto): Promise<import("./entities/customer.entity").Customer>;
    changePassword(user: CurrentUserData, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    getBookings(user: CurrentUserData): Promise<import("../bookings/entities/booking.entity").Booking[]>;
    deactivateAccount(user: CurrentUserData): Promise<{
        message: string;
    }>;
}
