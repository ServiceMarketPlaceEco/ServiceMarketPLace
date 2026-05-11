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

  async findByProvider(providerId: string): Promise<Review[]> {
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
