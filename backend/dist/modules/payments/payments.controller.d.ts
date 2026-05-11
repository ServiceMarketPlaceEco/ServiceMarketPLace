import { PaymentsService } from './payments.service';
import { CreatePaymentDto, PaymentQueryDto } from './dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    create(user: CurrentUserData, dto: CreatePaymentDto): Promise<import("./entities/payment.entity").Payment>;
    findOne(user: CurrentUserData, id: string): Promise<import("./entities/payment.entity").Payment | {
        error: string;
    }>;
    findByBooking(bookingId: string): Promise<import("./entities/payment.entity").Payment | null>;
    findCustomerPayments(user: CurrentUserData, query: PaymentQueryDto): Promise<import("./entities/payment.entity").Payment[]>;
}
