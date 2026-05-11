import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingDto } from './dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
    create(user: CurrentUserData, dto: CreateBookingDto): Promise<import("./entities/booking.entity").Booking>;
    findOne(user: CurrentUserData, id: string): Promise<import("./entities/booking.entity").Booking | {
        error: string;
    }>;
    update(user: CurrentUserData, id: string, dto: UpdateBookingDto): Promise<import("./entities/booking.entity").Booking>;
    cancel(user: CurrentUserData, id: string): Promise<import("./entities/booking.entity").Booking>;
}
