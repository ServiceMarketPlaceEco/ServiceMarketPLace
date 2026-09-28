// Unit tests for ReviewsService.
// This is the normal review path, not the fake review detector. That has its
// own spec file in the moderation folder.
// The rules I care about here are that you can only review a booking once it's
// completed, only once per booking, only your own review can be edited or
// deleted, and the provider's average rating gets recalculated every time any
// of that changes.
// Run with: npm test

import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { BookingStatus } from '../bookings/entities/booking.entity';

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

    it('blocks reviewing a booking that isnt completed yet', async () => {
      const booking = completedBooking();
      booking.status = BookingStatus.CONFIRMED;
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(service.create('cust-1', dto)).rejects.toThrow(BadRequestException);
      expect(reviewRepo.save).not.toHaveBeenCalled();
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

    it('recalculates the providers average rating after the review is saved', async () => {
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-1' }));

      await service.create('cust-1', dto);

      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', {
        rating: 4.5,
        totalReviews: 2,
      });
    });

    it('emails the provider that a new review came in', async () => {
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-1' }));

      await service.create('cust-1', dto);

      expect(mailService.sendNewReviewNotification).toHaveBeenCalled();
    });
  });

  describe('findByProvider', () => {
    it('returns that providers reviews newest first', async () => {
      reviewRepo.find.mockResolvedValue([]);

      await service.findByProvider('prov-1');

      const [options] = reviewRepo.find.mock.calls[0];
      expect(options.where).toEqual({ providerId: 'prov-1' });
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
