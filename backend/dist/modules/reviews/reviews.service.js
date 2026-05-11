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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const review_entity_1 = require("./entities/review.entity");
const booking_entity_1 = require("../bookings/entities/booking.entity");
const service_provider_entity_1 = require("../providers/entities/service-provider.entity");
const mail_service_1 = require("../mail/mail.service");
let ReviewsService = class ReviewsService {
    constructor(reviewRepository, bookingRepository, providerRepository, mailService) {
        this.reviewRepository = reviewRepository;
        this.bookingRepository = bookingRepository;
        this.providerRepository = providerRepository;
        this.mailService = mailService;
    }
    async create(customerId, dto) {
        const booking = await this.bookingRepository.findOne({
            where: { bookingId: dto.bookingId, customerId },
            relations: ['providerService', 'providerService.provider'],
        });
        if (!booking) {
            throw new common_1.NotFoundException('Booking not found');
        }
        if (booking.status !== booking_entity_1.BookingStatus.COMPLETED) {
            throw new common_1.BadRequestException('Can only review completed bookings');
        }
        const existingReview = await this.reviewRepository.findOne({
            where: { bookingId: dto.bookingId },
        });
        if (existingReview) {
            throw new common_1.ConflictException('You have already reviewed this booking');
        }
        const providerId = booking.providerService.providerId;
        const review = this.reviewRepository.create({
            bookingId: dto.bookingId,
            customerId,
            providerId,
            rating: dto.rating,
            comment: dto.comment,
        });
        const savedReview = await this.reviewRepository.save(review);
        await this.updateProviderRating(providerId);
        await this.mailService.sendNewReviewNotification(savedReview, booking.providerService.provider);
        return savedReview;
    }
    async findByProvider(providerId) {
        return this.reviewRepository.find({
            where: { providerId },
            relations: ['customer'],
            order: { createdAt: 'DESC' },
            select: {
                reviewId: true,
                rating: true,
                comment: true,
                createdAt: true,
                customer: {
                    customerId: true,
                    name: true,
                    profileImage: true,
                },
            },
        });
    }
    async findById(reviewId) {
        const review = await this.reviewRepository.findOne({
            where: { reviewId },
            relations: ['customer', 'provider'],
        });
        if (!review) {
            throw new common_1.NotFoundException('Review not found');
        }
        return review;
    }
    async update(customerId, reviewId, dto) {
        const review = await this.findById(reviewId);
        if (review.customerId !== customerId) {
            throw new common_1.ForbiddenException('You can only update your own reviews');
        }
        if (dto.rating !== undefined) {
            review.rating = dto.rating;
        }
        if (dto.comment !== undefined) {
            review.comment = dto.comment;
        }
        const updatedReview = await this.reviewRepository.save(review);
        await this.updateProviderRating(review.providerId);
        return updatedReview;
    }
    async remove(customerId, reviewId) {
        const review = await this.findById(reviewId);
        if (review.customerId !== customerId) {
            throw new common_1.ForbiddenException('You can only delete your own reviews');
        }
        const providerId = review.providerId;
        await this.reviewRepository.remove(review);
        await this.updateProviderRating(providerId);
    }
    async updateProviderRating(providerId) {
        const result = await this.reviewRepository
            .createQueryBuilder('review')
            .where('review.providerId = :providerId', { providerId })
            .select('AVG(review.rating)', 'avgRating')
            .addSelect('COUNT(review.reviewId)', 'totalReviews')
            .getRawOne();
        const avgRating = result?.avgRating ? parseFloat(result.avgRating).toFixed(2) : 0;
        const totalReviews = result?.totalReviews || 0;
        await this.providerRepository.update(providerId, {
            rating: Number(avgRating),
            totalReviews: Number(totalReviews),
        });
    }
    async findAll() {
        return this.reviewRepository.find({
            relations: ['customer', 'provider'],
            order: { createdAt: 'DESC' },
        });
    }
    async removeByAdmin(reviewId) {
        const review = await this.findById(reviewId);
        const providerId = review.providerId;
        await this.reviewRepository.remove(review);
        await this.updateProviderRating(providerId);
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(review_entity_1.Review)),
    __param(1, (0, typeorm_1.InjectRepository)(booking_entity_1.Booking)),
    __param(2, (0, typeorm_1.InjectRepository)(service_provider_entity_1.ServiceProvider)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        mail_service_1.MailService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map