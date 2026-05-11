import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { CreateReviewDto, UpdateReviewDto } from './dto';
import { MailService } from '../mail/mail.service';
export declare class ReviewsService {
    private reviewRepository;
    private bookingRepository;
    private providerRepository;
    private mailService;
    constructor(reviewRepository: Repository<Review>, bookingRepository: Repository<Booking>, providerRepository: Repository<ServiceProvider>, mailService: MailService);
    create(customerId: string, dto: CreateReviewDto): Promise<Review>;
    findByProvider(providerId: string): Promise<Review[]>;
    findById(reviewId: string): Promise<Review>;
    update(customerId: string, reviewId: string, dto: UpdateReviewDto): Promise<Review>;
    remove(customerId: string, reviewId: string): Promise<void>;
    private updateProviderRating;
    findAll(): Promise<Review[]>;
    removeByAdmin(reviewId: string): Promise<void>;
}
