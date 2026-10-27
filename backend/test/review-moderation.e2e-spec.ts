

// Integration tests for the fake-review moderation endpoints.
// Real Nest app, real JwtAuthGuard and AdminGuard, real validation pipe. Only the database is mocked.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';

import { ReviewModerationController } from '../src/modules/reviews/moderation/review-moderation.controller';
import { ReviewModerationService } from '../src/modules/reviews/moderation/review-moderation.service';
import { ReviewsService } from '../src/modules/reviews/reviews.service';
import { Review } from '../src/modules/reviews/entities/review.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { Booking, BookingStatus } from '../src/modules/bookings/entities/booking.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { AiScreeningService } from '../src/common/ai';
import { mockRepo, applyMainConfig, testConfigService, signTestToken } from './test-helpers';

describe('Review moderation endpoints (integration)', () => {
  let app: INestApplication;
  let reviewRepo: any;
  let customerRepo: any;
  let bookingRepo: any;
  let providerRepo: any;
  let adminRepo: any;
  let aiScreening: any;

  // the routes are admin only now, so every request signs in as an admin.
  // the jwt strategy looks the admin up to check theyre still active
  const adminToken = () => signTestToken({ sub: 'admin-1', email: 'a@x.com', userType: 'admin' });
  const customerToken = () => signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });

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
    adminRepo = { ...mockRepo(), findOne: jest.fn(async () => ({ id: 'admin-1', isActive: true, role: 'admin' })) };
    // fake ai so the tests never call openai for real
    aiScreening = { screen: jest.fn() };

    // the rating recalculation on remove uses a query builder, so give the
    // review repo one that returns a sensible average
    reviewRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avgRating: '4.0', totalReviews: '2' }),
    });

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ReviewModerationController],
      providers: [
        ReviewModerationService,
        ReviewsService,
        JwtStrategy,
        testConfigService,
        { provide: AiScreeningService, useValue: aiScreening },
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
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
        .set('Authorization', `Bearer ${adminToken()}`)
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
        .set('Authorization', `Bearer ${adminToken()}`)
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
        .set('Authorization', `Bearer ${adminToken()}`)
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
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect(res.body).toEqual({ reviewId: 'r-fake', kept: true });
      // keeping must never delete
      expect(reviewRepo.remove).not.toHaveBeenCalled();
    });

    it('returns 404 when keeping a review that doesnt exist', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/reviews/moderation/ghost/keep')
        .set('Authorization', `Bearer ${adminToken()}`)
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
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect(res.body).toEqual({ reviewId: 'r-fake', removed: true });
      expect(reviewRepo.remove).toHaveBeenCalled();
    });

    it('returns 404 when removing a review that doesnt exist', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/reviews/moderation/ghost/remove')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(404);
    });
  });

  // H3 in the qa report - anyone could scan or delete reviews without signing in
  describe('only admins can use it', () => {
    it('turns away a request with no login', async () => {
      await request(app.getHttpServer()).get('/api/reviews/moderation/scan').expect(401);
      await request(app.getHttpServer()).post('/api/reviews/moderation/r-fake/remove').expect(401);
      expect(reviewRepo.remove).not.toHaveBeenCalled();
    });

    it('turns away a signed in customer', async () => {
      customerRepo.findOne.mockResolvedValueOnce({ customerId: 'cust-1', isActive: true, isBlocked: false });

      await request(app.getHttpServer())
        .post('/api/reviews/moderation/r-good/remove')
        .set('Authorization', `Bearer ${customerToken()}`)
        .expect(403);
      expect(reviewRepo.remove).not.toHaveBeenCalled();
    });
  });

  // M5 in the qa report - the "Screen with AI" button used to get "Cannot POST"
  describe('POST /api/reviews/moderation/ai-screen', () => {
    it('returns the ai verdict and only sends the ai what it needs', async () => {
      aiScreening.screen.mockResolvedValue({ verdict: 'suspicious', explanation: 'One word five star review.' });

      const res = await request(app.getHttpServer())
        .post('/api/reviews/moderation/ai-screen')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          review: {
            reviewId: 'r-fake',
            customerId: 'cust-fake',
            customerName: 'Private Name',
            rating: 5,
            comment: 'best',
            score: 6,
            reasons: [{ signal: 'NO_BOOKING', detail: 'Reviewer never completed a booking', weight: 3 }],
          },
        })
        .expect(200);

      expect(res.body).toEqual({ verdict: 'suspicious', explanation: 'One word five star review.' });
      expect(aiScreening.screen).toHaveBeenCalledWith('review', {
        rating: 5,
        comment: 'best',
        detectorScore: 6,
        detectorReasons: ['Reviewer never completed a booking'],
      });
      // no names or ids go to the ai
      expect(JSON.stringify(aiScreening.screen.mock.calls[0])).not.toContain('Private Name');
    });

    it('rejects a body without the review', async () => {
      await request(app.getHttpServer())
        .post('/api/reviews/moderation/ai-screen')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ comment: 'best' })
        .expect(400);
      expect(aiScreening.screen).not.toHaveBeenCalled();
    });

    it('passes on a 503 when openai is not set up, so the dashboard can show it', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      aiScreening.screen.mockRejectedValue(new ServiceUnavailableException('AI screening is not configured yet.'));

      const res = await request(app.getHttpServer())
        .post('/api/reviews/moderation/ai-screen')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ review: { rating: 5, comment: 'best' } })
        .expect(503);

      expect(res.body.message).toBe('AI screening is not configured yet.');
    });
  });
});
