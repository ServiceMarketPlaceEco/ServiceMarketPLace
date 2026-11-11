import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Review, ReviewStatus } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { CreateReviewDto, UpdateReviewDto } from './dto';
import { MailService } from '../mail/mail.service';
import { AdminNotifierService } from '../mail/admin-notifier.service';

// what GET /reviews sends back for each review on the public page
export interface PublicReview {
  reviewId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  name: string;
  role: 'customer';
  // null for a review about a provider without a booking
  serviceTitle: string | null;
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
    // emails the admin team about reviews waiting for approval. optional so
    // the service still works where it isn't provided
    @Optional() private adminNotifier?: AdminNotifierService,
  ) {}

  // any signed-in customer can review: either one of their own bookings, or
  // any approved provider without a booking. every review is saved as
  // pending, so nothing shows on the site until an admin approves it
  async create(customerId: string, dto: CreateReviewDto): Promise<Review> {
    const { bookingId, providerId } = dto.bookingId
      ? await this.reviewTargetFromBooking(customerId, dto.bookingId)
      : await this.reviewTargetFromProvider(customerId, dto.providerId);

    const review = this.reviewRepository.create({
      bookingId,
      customerId,
      providerId,
      rating: dto.rating,
      comment: dto.comment,
      status: ReviewStatus.PENDING,
    });

    // it isn't public yet, so the provider's rating and the email to the
    // provider both wait until an admin approves it (see approve below)
    const saved = await this.reviewRepository.save(review);

    await this.adminNotifier?.notify(
      'Review waiting for approval',
      `A customer wrote a ${dto.rating}/5 review${bookingId ? '' : ' (no booking)'}. Approve or reject it on the Review approvals page.`,
      dto.comment,
    );
    return saved;
  }

  // one of the customer's bookings, finished or not (for example a provider
  // who never turned up), as long as a provider was given the job.
  // one review per booking
  private async reviewTargetFromBooking(customerId: string, bookingId: string) {
    const booking = await this.bookingRepository.findOne({
      where: { bookingId, customerId },
      relations: ['providerService', 'providerService.provider'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.providerService) {
      throw new BadRequestException('You can review this booking once a provider has been assigned');
    }

    const existingReview = await this.reviewRepository.findOne({ where: { bookingId } });
    if (existingReview) {
      throw new ConflictException('You have already reviewed this booking');
    }

    return { bookingId, providerId: booking.providerService.providerId };
  }

  // a provider the customer hasn't booked through the site. only approved,
  // active providers can be reviewed, and one review per customer per
  // provider, so nobody can pile reviews onto the same provider. a rejected
  // review doesn't count, so the customer can try again
  private async reviewTargetFromProvider(customerId: string, providerId?: string) {
    if (!providerId) {
      throw new BadRequestException('Choose a booking or a provider to review');
    }

    const provider = await this.providerRepository.findOne({
      where: { providerId, isVerified: true, isActive: true, isBlocked: false },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const existingReview = await this.reviewRepository.findOne({
      where: { customerId, providerId, bookingId: IsNull(), status: Not(ReviewStatus.REJECTED) },
    });
    if (existingReview) {
      throw new ConflictException('You have already reviewed this provider');
    }

    return { bookingId: null, providerId };
  }

  // ---------- admin approval ----------

  // the queue on the admin Reviews page, oldest first so nothing waits forever
  async findPending(): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { status: ReviewStatus.PENDING },
      relations: ['customer', 'provider', 'booking'],
      order: { createdAt: 'ASC' },
      select: {
        reviewId: true,
        bookingId: true,
        rating: true,
        comment: true,
        status: true,
        createdAt: true,
        customer: { customerId: true, name: true },
        provider: { providerId: true, providerName: true },
        booking: { bookingId: true, serviceName: true, status: true, date: true },
      },
    });
  }

  async approve(reviewId: string): Promise<Review> {
    const review = await this.findById(reviewId);
    review.status = ReviewStatus.APPROVED;
    review.moderatedAt = new Date();
    const saved = await this.reviewRepository.save(review);

    await this.updateProviderRating(review.providerId);
    // now that it's public, let the provider know
    if (review.provider) {
      await this.mailService.sendNewReviewNotification(saved, review.provider);
    }
    await this.emailReviewDecision(review, true);
    return saved;
  }

  // tells the customer what happened to their review
  private async emailReviewDecision(review: Review, approved: boolean): Promise<void> {
    if (!review.customer?.email) return;
    try {
      await this.mailService.sendReviewDecision(
        review.customer.email,
        review.customer.name,
        review.provider?.providerName || '',
        approved,
      );
    } catch (error) {
      console.error('Failed to send review decision email:', error);
    }
  }

  async reject(reviewId: string): Promise<Review> {
    const review = await this.findById(reviewId);
    const wasApproved = review.status === ReviewStatus.APPROVED;
    review.status = ReviewStatus.REJECTED;
    review.moderatedAt = new Date();
    const saved = await this.reviewRepository.save(review);
    // a rejected review no longer counts towards the rating
    if (wasApproved) await this.updateProviderRating(review.providerId);
    await this.emailReviewDecision(review, false);
    return saved;
  }

  // the customer's own reviews with their status, so they can see which are
  // still waiting for approval
  async findMine(customerId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { customerId },
      relations: ['provider', 'booking'],
      order: { createdAt: 'DESC' },
      select: {
        reviewId: true,
        bookingId: true,
        rating: true,
        comment: true,
        status: true,
        createdAt: true,
        provider: { providerId: true, providerName: true },
        booking: { bookingId: true, serviceName: true },
      },
    });
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
        status: ReviewStatus.APPROVED,
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
      // null for a review about a provider without a booking
      serviceTitle: review.booking?.providerService?.service?.serviceName || null,
      providerName: review.provider?.providerName || '',
    }));
  }

  // which of this customers bookings already have a review. the reviews page
  // uses it so the form only offers bookings they havent reviewed yet
  // (reviews about a provider without a booking have no booking id)
  async findReviewedBookingIds(customerId: string): Promise<string[]> {
    const reviews = await this.reviewRepository.find({
      where: { customerId, bookingId: Not(IsNull()) },
      select: { bookingId: true },
    });
    return reviews.map((review) => review.bookingId).filter((id): id is string => Boolean(id));
  }

  async findByProvider(providerId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { providerId, status: ReviewStatus.APPROVED },
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
    // an edited review is checked again before it shows
    review.status = ReviewStatus.PENDING;
    review.moderatedAt = null;

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
      .andWhere('review.status = :approved', { approved: ReviewStatus.APPROVED })
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
