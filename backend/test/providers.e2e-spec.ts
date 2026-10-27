// Integration tests for the provider endpoints and the fake-account moderation endpoints.
// Real Nest app, real JwtAuthGuard and ProviderGuard, real validation pipe. Only the database is mocked.
// Provider routes change the signed in provider's own profile, services and jobs,
// so the guard tests check customer and admin tokens are turned away.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Like, MoreThanOrEqual } from 'typeorm';

import { ProvidersController } from '../src/modules/providers/providers.controller';
import { ProvidersService } from '../src/modules/providers/providers.service';
import { AccountModerationController } from '../src/modules/providers/moderation/account-moderation.controller';
import { AccountModerationService } from '../src/modules/providers/moderation/account-moderation.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { ProviderService } from '../src/modules/providers/entities/provider-service.entity';
import { Booking } from '../src/modules/bookings/entities/booking.entity';
import { Review } from '../src/modules/reviews/entities/review.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { AiScreeningService } from '../src/common/ai';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

const SERVICE_UUID = '3f2b8c1e-9a4d-4e2b-8f1a-1c2d3e4f5a6b';

describe('Provider endpoints (integration)', () => {
  let app: INestApplication;
  let customerRepo: any;
  let providerRepo: any;
  let adminRepo: any;
  let bookingRepo: any;
  let providerServiceRepo: any;
  let reviewRepo: any;
  let mail: any;
  let aiScreening: any;

  // The JWT strategy looks the user up on every request, so each token helper
  // also sets up that lookup.
  function providerToken(overrides: any = {}) {
    // isVerified: true = an admin has approved them, otherwise the jwt strategy turns them away
    providerRepo.findOne.mockResolvedValue({ providerId: 'prov-1', isActive: true, isBlocked: false, isVerified: true, ...overrides });
    return signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });
  }

  function customerToken() {
    customerRepo.findOne.mockResolvedValue({ customerId: 'cust-1', isActive: true, isBlocked: false });
    return signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });
  }

  function adminToken() {
    adminRepo.findOne.mockResolvedValue({ id: 'admin-1', isActive: true, role: 'admin' });
    return signTestToken({ sub: 'admin-1', email: 'a@x.com', userType: 'admin' });
  }

  beforeAll(async () => {
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    adminRepo = mockRepo();
    bookingRepo = mockRepo();
    providerServiceRepo = mockRepo();
    reviewRepo = mockRepo();
    mail = { sendBookingStatusUpdate: jest.fn(), sendBookingConfirmation: jest.fn(), sendBookingCancellation: jest.fn() };
    // fake ai so the tests never call claude for real
    aiScreening = { screen: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AccountModerationController, ProvidersController],
      providers: [
        ProvidersService,
        AccountModerationService,
        BookingsService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(ProviderService), useValue: providerServiceRepo },
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: MailService, useValue: mail },
        { provide: AiScreeningService, useValue: aiScreening },
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
    for (const repo of [customerRepo, providerRepo, adminRepo, bookingRepo, providerServiceRepo, reviewRepo]) {
      repo.findOne.mockReset();
      repo.find.mockReset();
      repo.save.mockReset().mockImplementation(async (x: any) => x);
    }
  });

  // ---------- Public provider list and profile ----------

  describe('GET /api/providers (public)', () => {
    it('lists providers without signing in', async () => {
      providerRepo.find.mockResolvedValue([{ providerId: 'prov-1', providerName: 'Rajshahi Cleaners' }]);

      const res = await request(app.getHttpServer()).get('/api/providers').expect(200);

      expect(res.body).toEqual([{ providerId: 'prov-1', providerName: 'Rajshahi Cleaners' }]);
    });

    it('turns the query string into the right filters', async () => {
      providerRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer()).get('/api/providers?search=clean&minRating=4').expect(200);

      const where = providerRepo.find.mock.calls[0][0].where;
      // the query string arrives as text, so this also checks minRating is turned into the number 4
      expect(where.providerName).toEqual(Like('%clean%'));
      expect(where.rating).toEqual(MoreThanOrEqual(4));
    });
  });

  describe('GET /api/providers/:id (public profile)', () => {
    it('returns the profile with only available services', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'prov-1',
        providerName: 'Rajshahi Cleaners',
        providerServices: [
          { id: 'ps-1', serviceId: 's-1', isAvailable: true, price: 500, service: { serviceName: 'Home Cleaning' } },
          { id: 'ps-2', serviceId: 's-2', isAvailable: false, price: 900, service: { serviceName: 'AC Repair' } },
        ],
      });

      const res = await request(app.getHttpServer()).get('/api/providers/prov-1').expect(200);

      expect(res.body.services.map((s: any) => s.serviceName)).toEqual(['Home Cleaning']);
    });

    it('returns 404 for a provider that doesnt exist or is blocked', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await request(app.getHttpServer()).get('/api/providers/ghost').expect(404);
    });
  });

  // ---------- Guards on the provider's own routes ----------

  describe('provider-only routes', () => {
    const routes: [string, string][] = [
      ['get', '/api/providers/me/profile'],
      ['put', '/api/providers/me/profile'],
      ['put', '/api/providers/me/change-password'],
      ['get', '/api/providers/me/services'],
      ['post', '/api/providers/me/services'],
      ['put', '/api/providers/me/services/ps-1'],
      ['delete', '/api/providers/me/services/ps-1'],
      ['get', '/api/providers/me/bookings'],
      ['put', '/api/providers/me/bookings/bk-1/status'],
    ];

    it.each(routes)('%s %s returns 401 without a token', async (method, url) => {
      await (request(app.getHttpServer()) as any)[method](url).expect(401);
    });

    it.each(routes)('%s %s returns 403 for a customer token', async (method, url) => {
      const token = customerToken();
      await (request(app.getHttpServer()) as any)[method](url).set('Authorization', `Bearer ${token}`).expect(403);
    });

    it('returns 403 for an admin token too, since these are the providers own pages', async () => {
      const token = adminToken();
      await request(app.getHttpServer())
        .get('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 401 for a blocked provider even with a valid token', async () => {
      const token = providerToken({ isBlocked: true });
      await request(app.getHttpServer())
        .get('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  // ---------- Profile and password ----------

  describe('profile and password', () => {
    it('GET /me/profile returns the signed in providers profile', async () => {
      const token = providerToken({ providerName: 'Rajshahi Cleaners' });

      const res = await request(app.getHttpServer())
        .get('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.providerName).toBe('Rajshahi Cleaners');
    });

    it('PUT /me/profile saves allowed changes', async () => {
      const token = providerToken({ description: 'old' });

      const res = await request(app.getHttpServer())
        .put('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Deep cleaning across Rajshahi' })
        .expect(200);

      expect(res.body.description).toBe('Deep cleaning across Rajshahi');
    });

    it('PUT /me/profile rejects fields a provider is not allowed to set, like isVerified', async () => {
      const token = providerToken();

      await request(app.getHttpServer())
        .put('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ isVerified: true })
        .expect(400);

      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('PUT /me/change-password works with the right current password', async () => {
      const token = providerToken();
      const passwordHash = await bcrypt.hash('OldPass@1', 10);
      // first lookup is the JWT strategy, second is the password check
      providerRepo.findOne
        .mockResolvedValueOnce({ providerId: 'prov-1', isActive: true, isBlocked: false, isVerified: true })
        .mockResolvedValueOnce({ providerId: 'prov-1', passwordHash });

      const res = await request(app.getHttpServer())
        .put('/api/providers/me/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPass@1', newPassword: 'NewPass@2' })
        .expect(200);

      expect(res.body.message).toBe('Password changed successfully');
    });

    it('PUT /me/change-password returns 401 for a wrong current password', async () => {
      const token = providerToken();
      providerRepo.findOne
        .mockResolvedValueOnce({ providerId: 'prov-1', isActive: true, isBlocked: false, isVerified: true })
        .mockResolvedValueOnce({ providerId: 'prov-1', passwordHash: await bcrypt.hash('OldPass@1', 10) });

      await request(app.getHttpServer())
        .put('/api/providers/me/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrong', newPassword: 'NewPass@2' })
        .expect(401);
    });
  });

  // ---------- Services the provider offers ----------

  describe('managing offered services', () => {
    it('GET /me/services lists the providers offerings', async () => {
      const token = providerToken();
      providerServiceRepo.find.mockResolvedValue([{ id: 'ps-1', price: 500 }]);

      const res = await request(app.getHttpServer())
        .get('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([{ id: 'ps-1', price: 500 }]);
    });

    it('POST /me/services adds a service', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId: SERVICE_UUID, price: 500, description: 'Deep clean' })
        .expect(201);

      expect(res.body).toMatchObject({ providerId: 'prov-1', serviceId: SERVICE_UUID, price: 500 });
    });

    it('POST /me/services returns 409 when they already offer it', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-1' });

      await request(app.getHttpServer())
        .post('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId: SERVICE_UUID, price: 500 })
        .expect(409);
    });

    it.each([
      ['a service id that is not a UUID', { serviceId: 'cleaning', price: 500 }],
      ['a negative price', { serviceId: SERVICE_UUID, price: -1 }],
    ])('POST /me/services returns 400 for %s', async (_case, body) => {
      const token = providerToken();

      await request(app.getHttpServer())
        .post('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);
    });

    it('PUT /me/services/:id updates the price and availability', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-1', providerId: 'prov-1', price: 500, isAvailable: true });

      const res = await request(app.getHttpServer())
        .put('/api/providers/me/services/ps-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 650, isAvailable: false })
        .expect(200);

      expect(res.body).toMatchObject({ price: 650, isAvailable: false });
    });

    it('PUT /me/services/:id returns 404 for someone elses offering', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .put('/api/providers/me/services/ps-9')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 1 })
        .expect(404);
    });

    it('DELETE /me/services/:id removes the offering', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-1', providerId: 'prov-1' });

      const res = await request(app.getHttpServer())
        .delete('/api/providers/me/services/ps-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).toBe('Service removed successfully');
      expect(providerServiceRepo.remove).toHaveBeenCalled();
    });
  });

  // ---------- The provider's jobs ----------

  describe('provider jobs', () => {
    it('GET /me/bookings returns an empty list when they offer no services', async () => {
      const token = providerToken();
      providerServiceRepo.find.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/providers/me/bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('GET /me/bookings returns bookings for the providers services', async () => {
      const token = providerToken();
      providerServiceRepo.find.mockResolvedValue([{ id: 'ps-1' }]);
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ bookingId: 'bk-1' }]),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(qb);

      const res = await request(app.getHttpServer())
        .get('/api/providers/me/bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([{ bookingId: 'bk-1' }]);
      expect(qb.where).toHaveBeenCalledWith('booking.providerServiceId IN (:...serviceIds)', { serviceIds: ['ps-1'] });
    });

    it('PUT /me/bookings/:id/status accepts a pending job', async () => {
      const token = providerToken();
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', status: 'pending', providerService: { providerId: 'prov-1' } });

      const res = await request(app.getHttpServer())
        .put('/api/providers/me/bookings/bk-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(res.body.status).toBe('confirmed');
      expect(mail.sendBookingStatusUpdate).toHaveBeenCalled();
    });

    it('PUT /me/bookings/:id/status returns 400 for an impossible jump (pending to completed)', async () => {
      const token = providerToken();
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', status: 'pending', providerService: { providerId: 'prov-1' } });

      await request(app.getHttpServer())
        .put('/api/providers/me/bookings/bk-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' })
        .expect(400);
    });

    it('PUT /me/bookings/:id/status returns 403 for another providers job', async () => {
      const token = providerToken();
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', status: 'pending', providerService: { providerId: 'prov-2' } });

      await request(app.getHttpServer())
        .put('/api/providers/me/bookings/bk-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'confirmed' })
        .expect(403);
    });
  });

  // ---------- Fake-account moderation (admin dashboard) ----------
  // admin only now (JwtAuthGuard + AdminGuard on the controller), so these are
  // called with an admin token, which is how the admin dashboard uses them.

  describe('account moderation', () => {
    it('GET /providers/moderation/scan returns the flagged count and queue', async () => {
      const token = adminToken();
      providerRepo.find.mockResolvedValue([]);
      customerRepo.find.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/providers/moderation/scan')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ flaggedCount: 0, queue: [] });
    });

    it('POST /providers/moderation/:id/block blocks a provider', async () => {
      const token = adminToken();
      providerRepo.findOne.mockResolvedValue({ providerId: 'prov-9', isBlocked: false, isActive: true });

      const res = await request(app.getHttpServer())
        .post('/api/providers/moderation/prov-9/block')
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'provider' })
        .expect(200);

      expect(res.body).toEqual({ accountId: 'prov-9', blocked: true });
    });

    it('POST /providers/moderation/:id/keep keeps a customer account', async () => {
      const token = adminToken();
      providerRepo.findOne.mockResolvedValue(null);
      customerRepo.findOne.mockResolvedValue({ customerId: 'cust-9' });

      const res = await request(app.getHttpServer())
        .post('/api/providers/moderation/cust-9/keep')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ accountId: 'cust-9', kept: true });
    });

    it('POST /providers/moderation/:id/keep returns 404 for an unknown account', async () => {
      const token = adminToken();
      providerRepo.findOne.mockResolvedValue(null);
      customerRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/providers/moderation/ghost/keep')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    // H3 in the qa report - these used to work without signing in
    describe('only admins can use it', () => {
      it('turns away a request with no login', async () => {
        await request(app.getHttpServer()).get('/api/providers/moderation/scan').expect(401);
        await request(app.getHttpServer())
          .post('/api/providers/moderation/prov-9/block')
          .send({ kind: 'provider' })
          .expect(401);
        expect(providerRepo.save).not.toHaveBeenCalled();
      });

      it('turns away a signed in customer', async () => {
        await request(app.getHttpServer())
          .post('/api/providers/moderation/prov-9/block')
          .set('Authorization', `Bearer ${customerToken()}`)
          .send({ kind: 'provider' })
          .expect(403);
        expect(providerRepo.save).not.toHaveBeenCalled();
      });

      it('turns away a signed in provider', async () => {
        await request(app.getHttpServer())
          .get('/api/providers/moderation/scan')
          .set('Authorization', `Bearer ${providerToken()}`)
          .expect(403);
      });
    });

    // M5 in the qa report - the "Screen with AI" button used to get "Cannot POST"
    describe('POST /providers/moderation/ai-screen', () => {
      it('returns the ai verdict and only sends the ai the type, score and reasons', async () => {
        const token = adminToken();
        aiScreening.screen.mockResolvedValue({ verdict: 'suspicious', explanation: 'Shares a phone with another account.' });

        const res = await request(app.getHttpServer())
          .post('/api/providers/moderation/ai-screen')
          .set('Authorization', `Bearer ${token}`)
          .send({
            account: {
              accountId: 'prov-9',
              kind: 'provider',
              email: 'private@x.com',
              score: 5,
              reasons: [{ signal: 'DUPLICATE_IDENTITY', detail: 'Shares contact/ID details with account prov-8', weight: 3 }],
            },
          })
          .expect(200);

        expect(res.body).toEqual({ verdict: 'suspicious', explanation: 'Shares a phone with another account.' });
        expect(aiScreening.screen).toHaveBeenCalledWith('account', {
          kind: 'provider',
          detectorScore: 5,
          detectorReasons: ['Shares contact/ID details with account prov-8'],
        });
        // the email never goes to the ai
        expect(JSON.stringify(aiScreening.screen.mock.calls[0])).not.toContain('private@x.com');
      });

      it('rejects a body without the account', async () => {
        await request(app.getHttpServer())
          .post('/api/providers/moderation/ai-screen')
          .set('Authorization', `Bearer ${adminToken()}`)
          .send({})
          .expect(400);
        expect(aiScreening.screen).not.toHaveBeenCalled();
      });

      it('is admin only like the rest of the queue', async () => {
        await request(app.getHttpServer())
          .post('/api/providers/moderation/ai-screen')
          .send({ account: { kind: 'provider' } })
          .expect(401);
        expect(aiScreening.screen).not.toHaveBeenCalled();
      });
    });
  });

  // M7 in the qa report - a provider token is useless until an admin approves them
  it('turns away a provider who has not been approved yet', async () => {
    await request(app.getHttpServer())
      .get('/api/providers/me/profile')
      .set('Authorization', `Bearer ${providerToken({ isVerified: false })}`)
      .expect(401);
  });
});
