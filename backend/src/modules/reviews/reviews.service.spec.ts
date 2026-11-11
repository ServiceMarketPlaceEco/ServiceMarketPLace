import { IsNull, Not } from 'typeorm';
// Unit tests for ReviewsService.
// This is the normal review path, not the fake review detector. That has its
// own spec file in the moderation folder.
// The rules I care about here are that you can review any of your bookings
// once a provider has been assigned, only once per booking, every review waits
// for an admin before it shows, only your own review can be edited or
// deleted, and the provider's average rating only counts approved reviews.
// Run with: npm test

import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { BookingStatus } from '../bookings/entities/booking.entity';
import { ReviewStatus } from './entities/review.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((x: any) => x),
  save: jest.fn(async (x: any) => x),
  remove: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepo: any;
  let bookingRepo: any;
  let providerRepo: any;
  let mailService: any;

  // Every change to a review recalculates the provider average, and that runs
  // through a query builder. This stubs it so I can control what it returns.
  function stubRatingQuery(avgRating: string | null, totalReviews: number) {
    reviewRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avgRating, totalReviews }),
    });
  }

  beforeEach(() => {
    reviewRepo = mockRepo();
    bookingRepo = mockRepo();
    providerRepo = mockRepo();
    mailService = { sendNewReviewNotification: jest.fn() };

    stubRatingQuery('4.5', 2);

    service = new ReviewsService(reviewRepo, bookingRepo, providerRepo, mailService);
  });

  // the public reviews page (H6 - there was no GET /reviews before)
  describe('findPublic', () => {
    const fullReview = {
      reviewId: 'r-1',
      bookingId: 'b-1',
      customerId: 'c-1',
      providerId: 'p-1',
      rating: 5,
      comment: 'came on time and fixed the leak',
      createdAt: new Date('2026-10-01'),
      customer: { customerId: 'c-1', name: 'Fatima', email: 'fatima@x.com', phone: 1711111111 },
      provider: { providerId: 'p-1', providerName: 'Rahim Plumbing Services', email: 'rahim@x.com' },
      booking: { providerService: { service: { serviceName: 'Plumbing' } } },
    };

    it('only asks for reviews of approved, unblocked providers from unblocked customers', async () => {
      reviewRepo.find.mockResolvedValue([]);

      await service.findPublic();

      const [options] = reviewRepo.find.mock.calls[0];
      expect(options.where).toEqual({
        status: ReviewStatus.APPROVED,
        provider: { isVerified: true, isBlocked: false },
        customer: { isBlocked: false },
      });
      expect(options.order).toEqual({ createdAt: 'DESC' });
      expect(options.take).toBe(50);
    });

    it('flattens each review into the shape the reviews page reads', async () => {
      reviewRepo.find.mockResolvedValue([fullReview]);

      const [review] = await service.findPublic();

      expect(review).toEqual({
        reviewId: 'r-1',
        rating: 5,
        comment: 'came on time and fixed the leak',
        createdAt: new Date('2026-10-01'),
        name: 'Fatima',
        role: 'customer',
        serviceTitle: 'Plumbing',
        providerName: 'Rahim Plumbing Services',
      });
    });

    it('never sends emails, phone numbers or customer ids to the public page', async () => {
      reviewRepo.find.mockResolvedValue([fullReview]);

      const text = JSON.stringify(await service.findPublic());

      expect(text).not.toContain('fatima@x.com');
      expect(text).not.toContain('rahim@x.com');
      expect(text).not.toContain('1711111111');
      expect(text).not.toContain('c-1');
    });

    it('fills in sensible defaults when a relation is missing', async () => {
      reviewRepo.find.mockResolvedValue([{ reviewId: 'r-2', rating: 3, comment: 'ok', createdAt: new Date() }]);

      const [review] = await service.findPublic();

      expect(review).toMatchObject({ name: 'ServiceHub customer', serviceTitle: null, providerName: '' });
    });
  });

  describe('findReviewedBookingIds', () => {
    it('returns the booking ids this customer has already reviewed', async () => {
      reviewRepo.find.mockResolvedValue([{ bookingId: 'b-1' }, { bookingId: 'b-7' }]);

      expect(await service.findReviewedBookingIds('c-1')).toEqual(['b-1', 'b-7']);
      expect(reviewRepo.find.mock.calls[0][0].where).toEqual({ customerId: 'c-1', bookingId: Not(IsNull()) });
    });
  });

  // the admin team hears about a new review, and the customer hears the decision
  describe('notifications', () => {
    it('tells the admin team a review is waiting, saying when there was no booking', async () => {
      const notifier = { notify: jest.fn() };
      service = new ReviewsService(reviewRepo, bookingRepo, providerRepo, mailService, notifier as any);
      providerRepo.findOne.mockResolvedValue({ providerId: 'prov-1' });
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => r);

      await service.create('cust-1', { providerId: 'prov-1', rating: 2, comment: 'never came' } as any);

      expect(notifier.notify).toHaveBeenCalledWith(
        'Review waiting for approval',
        'A customer wrote a 2/5 review (no booking). Approve or reject it on the Review approvals page.',
        'never came',
      );
    });

    it('emails the customer when their review is approved or rejected', async () => {
      mailService.sendReviewDecision = jest.fn();
      const review = () => ({
        reviewId: 'rev-1',
        providerId: 'prov-1',
        status: ReviewStatus.PENDING,
        customer: { name: 'Nusrat', email: 'n@x.com' },
        provider: { providerId: 'prov-1', providerName: 'Karim Uddin' },
      });

      reviewRepo.findOne.mockResolvedValue(review());
      await service.approve('rev-1');
      reviewRepo.findOne.mockResolvedValue(review());
      await service.reject('rev-1');

      expect(mailService.sendReviewDecision.mock.calls).toEqual([
        ['n@x.com', 'Nusrat', 'Karim Uddin', true],
        ['n@x.com', 'Nusrat', 'Karim Uddin', false],
      ]);
    });
  });

  // reviews about a provider without a booking
  describe('create without a booking', () => {
    const dto: any = { providerId: 'prov-1', rating: 4, comment: 'fixed my neighbour\'s tap, very tidy' };
    const approvedProvider = { providerId: 'prov-1', isVerified: true, isActive: true, isBlocked: false };

    it('saves a pending review about the provider with no booking', async () => {
      providerRepo.findOne.mockResolvedValue(approvedProvider);
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-9' }));

      const result = await service.create('cust-1', dto);

      expect(result).toMatchObject({ bookingId: null, providerId: 'prov-1', status: ReviewStatus.PENDING });
      expect(bookingRepo.findOne).not.toHaveBeenCalled();
    });

    it('only allows approved, active providers', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.create('cust-1', dto)).rejects.toThrow(NotFoundException);
      expect(providerRepo.findOne.mock.calls[0][0].where).toEqual({
        providerId: 'prov-1',
        isVerified: true,
        isActive: true,
        isBlocked: false,
      });
      expect(reviewRepo.save).not.toHaveBeenCalled();
    });

    it('allows one review per customer per provider without a booking', async () => {
      providerRepo.findOne.mockResolvedValue(approvedProvider);
      reviewRepo.findOne.mockResolvedValue({ reviewId: 'rev-1', status: ReviewStatus.PENDING });

      await expect(service.create('cust-1', dto)).rejects.toThrow(ConflictException);
      expect(reviewRepo.findOne.mock.calls[0][0].where).toEqual({
        customerId: 'cust-1',
        providerId: 'prov-1',
        bookingId: IsNull(),
        status: Not(ReviewStatus.REJECTED),
      });
    });

    it('needs a booking or a provider', async () => {
      await expect(service.create('cust-1', { rating: 5 } as any)).rejects.toThrow(BadRequestException);
    });

    it('uses the booking when both are sent, so a booking review cannot be pinned on another provider', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 'b-1',
        customerId: 'cust-1',
        providerService: { providerId: 'prov-1', provider: { providerId: 'prov-1' } },
      });
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => r);

      const result = await service.create('cust-1', { bookingId: 'b-1', providerId: 'prov-other', rating: 3 } as any);

      expect(result.providerId).toBe('prov-1');
      expect(result.bookingId).toBe('b-1');
    });
  });

  describe('create', () => {
    const dto: any = { bookingId: 'b-1', rating: 5, comment: 'great work, very tidy' };

    // A completed booking belonging to cust-1, with prov-1 as the provider.
    function completedBooking() {
      return {
        bookingId: 'b-1',
        customerId: 'cust-1',
        status: BookingStatus.COMPLETED,
        providerService: {
          providerId: 'prov-1',
          provider: { providerId: 'prov-1', email: 'p@x.com' },
        },
      };
    }

    it('creates a review for a completed booking', async () => {
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-1' }));

      const result = await service.create('cust-1', dto);

      expect(result.reviewId).toBe('rev-1');
      expect(result.rating).toBe(5);
      expect(result.providerId).toBe('prov-1');
    });

    it('allows reviewing a booking that isnt completed, like a no-show', async () => {
      const booking = completedBooking();
      booking.status = BookingStatus.CONFIRMED;
      bookingRepo.findOne.mockResolvedValue(booking);
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-1' }));

      const result = await service.create('cust-1', dto);

      expect(result.reviewId).toBe('rev-1');
    });

    it('blocks reviewing a booking before a provider is assigned', async () => {
      const booking: any = completedBooking();
      booking.status = BookingStatus.PENDING;
      booking.providerService = null;
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(service.create('cust-1', dto)).rejects.toThrow(BadRequestException);
      expect(reviewRepo.save).not.toHaveBeenCalled();
    });

    it('saves every new review as pending', async () => {
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-1' }));

      const result = await service.create('cust-1', dto);

      expect(result.status).toBe(ReviewStatus.PENDING);
    });

    it('blocks a second review on the same booking', async () => {
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue({ reviewId: 'rev-existing' });

      await expect(service.create('cust-1', dto)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the booking isnt the customers or doesnt exist', async () => {
      // The query filters on bookingId and customerId together, so someone else's
      // booking just comes back as null rather than a permission error.
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.create('cust-2', dto)).rejects.toThrow(NotFoundException);
    });

    it('does not touch the rating or email the provider until it is approved', async () => {
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-1' }));

      await service.create('cust-1', dto);

      expect(providerRepo.update).not.toHaveBeenCalled();
      expect(mailService.sendNewReviewNotification).not.toHaveBeenCalled();
    });
  });

  describe('admin approval', () => {
    const pendingReview = () => ({
      reviewId: 'rev-1',
      providerId: 'prov-1',
      status: ReviewStatus.PENDING,
      provider: { providerId: 'prov-1', email: 'p@x.com' },
    });

    it('lists pending reviews oldest first', async () => {
      reviewRepo.find.mockResolvedValue([]);

      await service.findPending();

      const [options] = reviewRepo.find.mock.calls[0];
      expect(options.where).toEqual({ status: ReviewStatus.PENDING });
      expect(options.order).toEqual({ createdAt: 'ASC' });
    });

    it('approving makes it public, recalculates the rating and emails the provider', async () => {
      reviewRepo.findOne.mockResolvedValue(pendingReview());

      const result = await service.approve('rev-1');

      expect(result.status).toBe(ReviewStatus.APPROVED);
      expect(result.moderatedAt).toBeInstanceOf(Date);
      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', { rating: 4.5, totalReviews: 2 });
      expect(mailService.sendNewReviewNotification).toHaveBeenCalled();
    });

    it('rejecting a pending review leaves the rating alone', async () => {
      reviewRepo.findOne.mockResolvedValue(pendingReview());

      const result = await service.reject('rev-1');

      expect(result.status).toBe(ReviewStatus.REJECTED);
      expect(providerRepo.update).not.toHaveBeenCalled();
      expect(mailService.sendNewReviewNotification).not.toHaveBeenCalled();
    });

    it('rejecting an approved review takes it out of the rating', async () => {
      reviewRepo.findOne.mockResolvedValue({ ...pendingReview(), status: ReviewStatus.APPROVED });

      await service.reject('rev-1');

      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', { rating: 4.5, totalReviews: 2 });
    });

    it('only counts approved reviews in the rating', async () => {
      reviewRepo.findOne.mockResolvedValue(pendingReview());

      await service.approve('rev-1');

      const qb = reviewRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('review.status = :approved', { approved: ReviewStatus.APPROVED });
    });

    it('lists the customers own reviews with their status', async () => {
      reviewRepo.find.mockResolvedValue([]);

      await service.findMine('cust-1');

      const [options] = reviewRepo.find.mock.calls[0];
      expect(options.where).toEqual({ customerId: 'cust-1' });
      expect(options.select.status).toBe(true);
    });
  });

  describe('findByProvider', () => {
    it('returns that providers reviews newest first', async () => {
      reviewRepo.find.mockResolvedValue([]);

      await service.findByProvider('prov-1');

      const [options] = reviewRepo.find.mock.calls[0];
      expect(options.where).toEqual({ providerId: 'prov-1', status: ReviewStatus.APPROVED });
      expect(options.order).toEqual({ createdAt: 'DESC' });
    });

    it('only exposes safe customer fields on a public review', async () => {
      reviewRepo.find.mockResolvedValue([]);

      await service.findByProvider('prov-1');

      const [options] = reviewRepo.find.mock.calls[0];
      // Name and profile image are fine to show publicly. Email and phone are not,
      // so they shouldn't be in the select list at all.
      expect(options.select.customer.name).toBe(true);
      expect(options.select.customer.email).toBeUndefined();
      expect(options.select.customer.phone).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('throws NotFoundException for a review that doesnt exist', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('lets the author change their rating and comment', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        rating: 5,
        comment: 'old comment',
      });

      const result = await service.update('cust-1', 'rev-1', {
        rating: 3,
        comment: 'new comment',
      } as any);

      expect(result.rating).toBe(3);
      expect(result.comment).toBe('new comment');
    });

    it('sends an edited review back for approval', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        rating: 5,
        comment: 'old',
        status: ReviewStatus.APPROVED,
      });

      const result = await service.update('cust-1', 'rev-1', { comment: 'changed my mind' } as any);

      expect(result.status).toBe(ReviewStatus.PENDING);
      expect(result.moderatedAt).toBeNull();
    });

    it('blocks editing someone elses review', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await expect(
        service.update('cust-2', 'rev-1', { rating: 1 } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('leaves the comment alone when only the rating is changed', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        rating: 5,
        comment: 'keep me',
      });

      const result = await service.update('cust-1', 'rev-1', { rating: 4 } as any);

      expect(result.comment).toBe('keep me');
    });

    it('recalculates the provider rating after an edit', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        rating: 5,
      });

      await service.update('cust-1', 'rev-1', { rating: 2 } as any);

      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', expect.any(Object));
    });
  });

  describe('remove', () => {
    it('lets the author delete their own review', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await service.remove('cust-1', 'rev-1');

      expect(reviewRepo.remove).toHaveBeenCalled();
    });

    it('blocks deleting someone elses review', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await expect(service.remove('cust-2', 'rev-1')).rejects.toThrow(ForbiddenException);
      expect(reviewRepo.remove).not.toHaveBeenCalled();
    });

    it('recalculates the provider rating after a delete', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await service.remove('cust-1', 'rev-1');

      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', expect.any(Object));
    });

    it('resets the provider to 0 when their last review is deleted', async () => {
      stubRatingQuery(null, 0);
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await service.remove('cust-1', 'rev-1');

      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', {
        rating: 0,
        totalReviews: 0,
      });
    });
  });

  describe('removeByAdmin', () => {
    it('removes the review without needing the customer id', async () => {
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await service.removeByAdmin('rev-1');

      expect(reviewRepo.remove).toHaveBeenCalled();
      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', expect.any(Object));
    });

    it('throws NotFoundException for a review that doesnt exist', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await expect(service.removeByAdmin('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
