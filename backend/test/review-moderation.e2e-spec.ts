// integration tests for the review moderation endpoints
// boots a real nest app and hits the moderation routes over http.
// the db is mocked (same approach as the other e2e specs) so we control
// exactly which reviews the scan sees.
// run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { ReviewModerationController } from '../src/modules/reviews/moderation/review-moderation.controller';
import { ReviewModerationService } from '../src/modules/reviews/moderation/review-moderation.service';
import { ReviewsService } from '../src/modules/reviews/reviews.service';
import { Review } from '../src/modules/reviews/entities/review.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { Booking, BookingStatus } from '../src/modules/bookings/entities/booking.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { mockRepo, applyMainConfig } from './test-helpers';

describe('Review moderation endpoints (integration)', () => {
  let app: INestApplication;
  let reviewRepo: any;
  let customerRepo: any;
  let bookingRepo: any;
  let providerRepo: any;

  // a clearly fake review: brand new account, no booking, generic text
  const fakeReview = {
    reviewId: 'r-fake',
    customerId: 'cust-fake',
    providerId: 'prov-1',
    rating: 5,
    comment: 'best',
    createdAt: new Date('2026-08-01T12:00:00Z'),
  };

  // a clearly genuine review: real comment, moderate rating
  const goodReview = {
    reviewId: 'r-good',
    customerId: 'cust-good',
    providerId: 'prov-2',
    rating: 4,
    comment: 'The electrician was on time and rewired the switchboard neatly.',
    createdAt: new Date('2026-08-01T12:00:00Z'),
  };

  beforeAll(async () => {
    reviewRepo = mockRepo();
    customerRepo = mockRepo();
    bookingRepo = mockRepo();
    providerRepo = mockRepo();

    // the rating recalculation on remove uses a query builder, so give the
    // review repo one that returns a sensible average
    reviewRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avgRating: '4.0', totalReviews: '2' }),
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [ReviewModerationController],
      providers: [
        ReviewModerationService,
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        {
          provide: MailService,
          useValue: { sendReviewNotification: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    applyMainConfig(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // the fake account is brand new; the good account is old
    customerRepo.find.mockResolvedValue([
      { customerId: 'cust-fake', createdAt: new Date('2026-07-31T12:00:00Z') },
      { customerId: 'cust-good', createdAt: new Date('2026-01-01T12:00:00Z') },
    ]);
    // nobody has a completed booking in these tests (drives the NO_BOOKING signal)
    bookingRepo.count.mockResolvedValue(0);
  });

  describe('GET /api/reviews/moderation/scan', () => {
    it('flags the fake review and leaves the genuine one out', async () => {
      reviewRepo.find.mockResolvedValue([fakeReview, goodReview]);

      const res = await request(app.getHttpServer())
        .get('/api/reviews/moderation/scan')
        .expect(200);

      expect(res.body.flaggedCount).toBeGreaterThanOrEqual(1);
      const ids = res.body.queue.map((q: any) => q.reviewId);
      expect(ids).toContain('r-fake');
      expect(ids).not.toContain('r-good');
    });

    it('each flagged review comes back with human-readable reasons', async () => {
      reviewRepo.find.mockResolvedValue([fakeReview]);

      const res = await request(app.getHttpServer())
        .get('/api/reviews/moderation/scan')
        .expect(200);

      const flagged = res.body.queue[0];
      expect(flagged.reasons.length).toBeGreaterThan(0);
      // every reason has a signal code and a detail sentence
      expect(flagged.reasons[0]).toHaveProperty('signal');
      expect(flagged.reasons[0]).toHaveProperty('detail');
    });

    it('returns an empty queue when there are no reviews', async () => {
      reviewRepo.find.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/reviews/moderation/scan')
        .expect(200);

      expect(res.body.flaggedCount).toBe(0);
      expect(res.body.queue).toEqual([]);
    });
  });

  describe('POST /api/reviews/moderation/:id/keep', () => {
    it('keeps a review the admin decided is genuine', async () => {
      reviewRepo.findOne.mockResolvedValue({ reviewId: 'r-fake' });

      const res = await request(app.getHttpServer())
        .post('/api/reviews/moderation/r-fake/keep')
        .expect(200);

      expect(res.body).toEqual({ reviewId: 'r-fake', kept: true });
      // keeping must never delete
      expect(reviewRepo.remove).not.toHaveBeenCalled();
    });

    it('returns 404 when keeping a review that doesnt exist', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/reviews/moderation/ghost/keep')
        .expect(404);
    });
  });

  describe('POST /api/reviews/moderation/:id/remove', () => {
    it('removes a review the admin confirmed is fake', async () => {
      // removeByAdmin looks the review up first, then removes it
      reviewRepo.findOne.mockResolvedValue({ reviewId: 'r-fake', providerId: 'prov-1' });
      reviewRepo.find.mockResolvedValue([]); // for the rating recalculation

      const res = await request(app.getHttpServer())
        .post('/api/reviews/moderation/r-fake/remove')
        .expect(200);

      expect(res.body).toEqual({ reviewId: 'r-fake', removed: true });
      expect(reviewRepo.remove).toHaveBeenCalled();
    });

    it('returns 404 when removing a review that doesnt exist', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/reviews/moderation/ghost/remove')
        .expect(404);
    });
  });
});
