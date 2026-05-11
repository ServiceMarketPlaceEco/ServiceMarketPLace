import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class ReviewsController {
    private readonly reviewsService;
    constructor(reviewsService: ReviewsService);
    create(user: CurrentUserData, dto: CreateReviewDto): Promise<import("./entities/review.entity").Review>;
    findByProvider(providerId: string): Promise<import("./entities/review.entity").Review[]>;
    findOne(id: string): Promise<import("./entities/review.entity").Review>;
    update(user: CurrentUserData, id: string, dto: UpdateReviewDto): Promise<import("./entities/review.entity").Review>;
    remove(user: CurrentUserData, id: string): Promise<{
        message: string;
    }>;
}
