// This is the normal review path. The fake review detector is tested separately in review-moderation.e2e-spec.ts.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { ReviewsController } from '../src/modules/reviews/reviews.controller';
import { ReviewsService } from '../src/modules/reviews/reviews.service';
import { Review } from '../src/modules/reviews/entities/review.entity';
import { Booking, BookingStatus } from '../src/modules/bookings/entities/booking.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

const BOOKING_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('Review endpoints (integration)', () => {
  let app: INestApplication;
  let reviewRepo: any;
  let bookingRepo: any;
  let providerRepo: any;
  let customerRepo: any;
  let mailService: any;

  function customerToken(id = 'cust-1') {
    customerRepo.findOne.mockResolvedValue({
      customerId: id,
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: id, email: 'c@x.com', userType: 'customer' });
  }

  function providerTokenValue() {
    providerRepo.findOne.mockResolvedValue({
      providerId: 'prov-1',
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });
  }

  // The provider average gets recalculated every time a review changes, and
  // that runs through a query builder, so it needs stubbing on every test.
  function stubRatingQuery(avgRating: string | null = '4.5', totalReviews = 2) {
    reviewRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avgRating, totalReviews }),
    });
  }

  beforeAll(async () => {
    reviewRepo = mockRepo();
    bookingRepo = mockRepo();
    providerRepo = mockRepo();
    customerRepo = mockRepo();
    mailService = { sendNewReviewNotification: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ReviewsController],
      providers: [
        ReviewsService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(Admin), useValue: mockRepo() },
        { provide: MailService, useValue: mailService },
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
    stubRatingQuery();
  });

  // ---------- leaving a review ----------

  describe('POST /api/reviews', () => {
    function completedBooking() {
      return {
        bookingId: BOOKING_ID,
        customerId: 'cust-1',
        status: BookingStatus.COMPLETED,
        providerService: {
          providerId: 'prov-1',
          provider: { providerId: 'prov-1', email: 'p@x.com' },
        },
      };
    }

    it('rejects a review with no token (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/reviews')
        .send({ bookingId: BOOKING_ID, rating: 5 })
        .expect(401);
    });

    it('rejects a provider trying to leave a review (403)', async () => {
      const token = providerTokenValue();

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 5 })
        .expect(403);
    });

    it('creates a review for a completed booking', async () => {
      const token = customerToken();
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-1' }));

      const res = await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 5, comment: 'great work, very tidy' })
        .expect(201);

      expect(res.body.reviewId).toBe('rev-1');
      expect(res.body.rating).toBe(5);
      // The author comes from the token. Nobody should be able to post a review
      // as somebody else by putting a different id in the body.
      expect(res.body.customerId).toBe('cust-1');
    });

    it('returns 400 when the booking isnt completed yet', async () => {
      const token = customerToken();
      const booking = completedBooking();
      booking.status = BookingStatus.CONFIRMED;
      bookingRepo.findOne.mockResolvedValue(booking);

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 5 })
        .expect(400);
    });

    it('returns 409 when the booking was already reviewed', async () => {
      const token = customerToken();
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue({ reviewId: 'rev-existing' });

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 5 })
        .expect(409);
    });

    it('returns 404 when reviewing a booking that isnt yours', async () => {
      const token = customerToken('cust-2');
      // The lookup filters on customerId, so someone else's booking is just null.
      bookingRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 5 })
        .expect(404);
    });

    it('recalculates the provider average after the review saves', async () => {
      const token = customerToken();
      bookingRepo.findOne.mockResolvedValue(completedBooking());
      reviewRepo.findOne.mockResolvedValue(null);
      reviewRepo.save.mockImplementation(async (r: any) => ({ ...r, reviewId: 'rev-1' }));

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 5 })
        .expect(201);

      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', {
        rating: 4.5,
        totalReviews: 2,
      });
    });

    // ---- validation ----

    it('rejects a rating of 0 (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 0 })
        .expect(400);
    });

    it('rejects a rating above 5 (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 6 })
        .expect(400);
    });

    it('rejects a half star rating, ratings are whole numbers (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 4.5 })
        .expect(400);
    });

    it('rejects a bookingId that isnt a uuid (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: 'not-a-uuid', rating: 5 })
        .expect(400);
    });

    it('rejects a body trying to set the providerId directly (400)', async () => {
      const token = customerToken();

      // The providerId is worked out from the booking. A customer must not get to
      // pick which provider their review lands on.
      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, rating: 5, providerId: 'prov-999' })
        .expect(400);
    });
  });

  // ---------- reading reviews ----------

  describe('GET /api/reviews/provider/:providerId', () => {
    it('is public, anyone can read a providers reviews', async () => {
      reviewRepo.find.mockResolvedValue([{ reviewId: 'rev-1', rating: 5 }]);

      const res = await request(app.getHttpServer())
        .get('/api/reviews/provider/prov-1')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /api/reviews/:id', () => {
    it('returns 404 for a review that doesnt exist', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/api/reviews/ghost').expect(404);
    });
  });

  // ---------- editing and deleting ----------

  describe('PUT /api/reviews/:id', () => {
    it('lets the author edit their own review', async () => {
      const token = customerToken();
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        rating: 5,
        comment: 'old comment',
      });

      const res = await request(app.getHttpServer())
        .put('/api/reviews/rev-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 3, comment: 'changed my mind' })
        .expect(200);

      expect(res.body.rating).toBe(3);
      expect(res.body.comment).toBe('changed my mind');
    });

    it('blocks editing someone elses review (403)', async () => {
      const token = customerToken('cust-2');
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await request(app.getHttpServer())
        .put('/api/reviews/rev-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 1 })
        .expect(403);
    });

    it('rejects an out of range rating on an edit (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .put('/api/reviews/rev-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 99 })
        .expect(400);
    });
  });

  describe('DELETE /api/reviews/:id', () => {
    it('lets the author delete their own review', async () => {
      const token = customerToken();
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await request(app.getHttpServer())
        .delete('/api/reviews/rev-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(reviewRepo.remove).toHaveBeenCalled();
    });

    it('blocks deleting someone elses review (403)', async () => {
      const token = customerToken('cust-2');
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await request(app.getHttpServer())
        .delete('/api/reviews/rev-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(reviewRepo.remove).not.toHaveBeenCalled();
    });

    it('resets the provider to 0 when their last review is deleted', async () => {
      stubRatingQuery(null, 0);
      const token = customerToken();
      reviewRepo.findOne.mockResolvedValue({
        reviewId: 'rev-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      await request(app.getHttpServer())
        .delete('/api/reviews/rev-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', {
        rating: 0,
        totalReviews: 0,
      });
    });
  });
});
