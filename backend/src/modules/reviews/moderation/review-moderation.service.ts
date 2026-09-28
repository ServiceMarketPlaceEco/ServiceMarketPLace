// moderation service - the admin-triggered scan
//
// this is the thin layer between the raw scoring logic and the rest of the
// app. it pulls reviews out of the database, attaches the extra context each
// review needs (how old the customer account is, whether they actually booked
// this provider), then runs the detector and hands back the flagged queue.
//
// there are no endpoints yet - thats the next piece. this is just the callable
// service so the logic can be tested and wired in later.

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { ReviewsService } from '../reviews.service';
import {
  scanReviews,
  ScorableReview,
  ReviewScore,
  DETECTION_CONFIG,
} from './fake-review-detector';

@Injectable()
export class ReviewModerationService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    // reuse the existing admin remove logic (it also recalculates the
    // providers average rating after the review is gone)
    private reviewsService: ReviewsService,
  ) {}

  // run a full scan over every review and return the flagged queue.
  // this is what the admin "Scan reviews" button will eventually call.
  async scanAllReviews(): Promise<ReviewScore[]> {
    const reviews = await this.reviewRepository.find();
    const scorable = await this.attachContext(reviews);
    return scanReviews(scorable, DETECTION_CONFIG);
  }

  // admin looked at a flagged review and decided its actually genuine.
  // we dont delete anything - just confirm it exists and report it kept.
  // (once you add a `status` column to reviews, set it to 'approved' here.)
  async keepReview(reviewId: string): Promise<{ reviewId: string; kept: boolean }> {
    const review = await this.reviewRepository.findOne({ where: { reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return { reviewId, kept: true };
  }

  // admin confirmed the review is fake - remove it. we reuse the existing
  // admin removal logic so the providers rating gets recalculated too.
  async removeReview(reviewId: string): Promise<{ reviewId: string; removed: boolean }> {
    await this.reviewsService.removeByAdmin(reviewId);
    return { reviewId, removed: true };
  }

  // turn raw Review rows into ScorableReview objects by looking up the two
  // bits of context the detector wants but the review row doesnt carry:
  //   - when the customers account was created (for the new-account signal)
  //   - whether they have a completed booking with the provider theyre reviewing
  private async attachContext(reviews: Review[]): Promise<ScorableReview[]> {
    if (reviews.length === 0) return [];

    // load the customers involved once, then look them up in a map, instead
    // of hitting the db per review
    const customerIds = [...new Set(reviews.map((r) => r.customerId))];
    const customers = await this.customerRepository.find({
      where: customerIds.map((customerId) => ({ customerId })),
    });
    const customerById = new Map(customers.map((c) => [c.customerId, c]));

    const scorable: ScorableReview[] = [];
    for (const review of reviews) {
      const customer = customerById.get(review.customerId);

      // does this customer have a completed booking with this provider?
      // we check via the booking table. if we cant tell, leave it undefined
      // so the detector simply skips that signal rather than guessing.
      let hasCompletedBooking: boolean | undefined = undefined;
      if (review.providerId) {
        const completed = await this.bookingRepository.count({
          where: {
            customerId: review.customerId,
            status: BookingStatus.COMPLETED,
          },
        });
        hasCompletedBooking = completed > 0;
      }

      scorable.push({
        reviewId: review.reviewId,
        customerId: review.customerId,
        providerId: review.providerId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        customerCreatedAt: customer?.createdAt,
        hasCompletedBookingWithProvider: hasCompletedBooking,
      });
    }

    return scorable;
  }
}
