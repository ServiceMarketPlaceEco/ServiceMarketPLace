import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { CreateReviewDto, UpdateReviewDto } from './dto';
import { MailService } from '../mail/mail.service';

// what GET /reviews sends back for each review on the public page
export interface PublicReview {
  reviewId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  name: string;
  role: 'customer';
  serviceTitle: string;
  providerName: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
    private mailService: MailService,
  ) {}

  async create(customerId: string, dto: CreateReviewDto): Promise<Review> {
    // Verify booking exists and belongs to customer
    const booking = await this.bookingRepository.findOne({
      where: { bookingId: dto.bookingId, customerId },
      relations: ['providerService', 'providerService.provider'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check booking is completed
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Can only review completed bookings');
    }

    // Check if already reviewed
    const existingReview = await this.reviewRepository.findOne({
      where: { bookingId: dto.bookingId },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this booking');
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

    // Update provider's average rating
    await this.updateProviderRating(providerId);

    // Send review notification to provider
    await this.mailService.sendNewReviewNotification(savedReview, booking.providerService.provider);

    return savedReview;
  }

  // the public reviews page. before this there was no GET /reviews at all, so
  // the page always said 0 reviews even with reviews in the database (H6 in
  // the qa report).
  //
  // only reviews about approved, unblocked providers from unblocked customers
  // show up, so once the admin blocks a fake account its reviews disappear
  // from the page too. we send back a flat, public-safe shape - just the
  // customers name, no email, phone or ids apart from the review id.
  async findPublic(limit = 50): Promise<PublicReview[]> {
    const reviews = await this.reviewRepository.find({
      where: {
        provider: { isVerified: true, isBlocked: false },
        customer: { isBlocked: false },
      },
      relations: ['customer', 'provider', 'booking', 'booking.providerService', 'booking.providerService.service'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return reviews.map((review) => ({
      reviewId: review.reviewId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      name: review.customer?.name || 'ServiceHub customer',
      // only customers can write reviews (CustomerGuard on POST /reviews)
      role: 'customer',
      serviceTitle: review.booking?.providerService?.service?.serviceName || 'Service',
      providerName: review.provider?.providerName || '',
    }));
  }

  // which of this customers bookings already have a review. the reviews page
  // uses it so the form only offers finished bookings they havent reviewed yet
  async findReviewedBookingIds(customerId: string): Promise<string[]> {
    const reviews = await this.reviewRepository.find({
      where: { customerId },
      select: { bookingId: true },
    });
    return reviews.map((review) => review.bookingId);
  }

  async findByProvider(providerId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { providerId },
      relations: ['customer', 'booking', 'booking.providerService', 'booking.providerService.service'],
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

  async findById(reviewId: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { reviewId },
      relations: ['customer', 'provider'],
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async update(customerId: string, reviewId: string, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.findById(reviewId);

    if (review.customerId !== customerId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    if (dto.rating !== undefined) {
      review.rating = dto.rating;
    }
    if (dto.comment !== undefined) {
      review.comment = dto.comment;
    }

    const updatedReview = await this.reviewRepository.save(review);

    // Update provider's average rating
    await this.updateProviderRating(review.providerId);

    return updatedReview;
  }

  async remove(customerId: string, reviewId: string): Promise<void> {
    const review = await this.findById(reviewId);

    if (review.customerId !== customerId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    const providerId = review.providerId;
    await this.reviewRepository.remove(review);

    // Update provider's average rating
    await this.updateProviderRating(providerId);
  }

  private async updateProviderRating(providerId: string): Promise<void> {
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

  // Admin methods
  async findAll(): Promise<Review[]> {
    return this.reviewRepository.find({
      relations: ['customer', 'provider'],
      order: { createdAt: 'DESC' },
    });
  }

  async removeByAdmin(reviewId: string): Promise<void> {
    const review = await this.findById(reviewId);
    const providerId = review.providerId;

    await this.reviewRepository.remove(review);
    await this.updateProviderRating(providerId);
  }
}
