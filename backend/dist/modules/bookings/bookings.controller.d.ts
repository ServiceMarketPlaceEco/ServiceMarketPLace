import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingDto, BookingQueryDto } from './dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
    findAll(query: BookingQueryDto): Promise<import("./entities/booking.entity").Booking[]>;
    findAllPublic(query: BookingQueryDto): Promise<import("./entities/booking.entity").Booking[]>;
    updateStatus(id: string, body: {
        status: string;
    }): Promise<import("./entities/booking.entity").Booking>;
    create(user: CurrentUserData, dto: CreateBookingDto): Promise<import("./entities/booking.entity").Booking>;
    getMyBookings(user: CurrentUserData, query: BookingQueryDto): Promise<import("./entities/booking.entity").Booking[]>;
    findOne(user: CurrentUserData, id: string): Promise<import("./entities/booking.entity").Booking | {
        error: string;
    }>;
    update(user: CurrentUserData, id: string, dto: UpdateBookingDto): Promise<import("./entities/booking.entity").Booking>;
    cancel(user: CurrentUserData, id: string): Promise<import("./entities/booking.entity").Booking>;
}
