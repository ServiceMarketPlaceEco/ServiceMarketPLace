
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';

import { ProvidersController } from '../src/modules/providers/providers.controller';
import { ProvidersService } from '../src/modules/providers/providers.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { ProviderService } from '../src/modules/providers/entities/provider-service.entity';
import { Booking, BookingStatus } from '../src/modules/bookings/entities/booking.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

describe('Provider endpoints (integration)', () => {
  let app: INestApplication;
  let providerRepo: any;
  let providerServiceRepo: any;
  let bookingRepo: any;
  let customerRepo: any;
  let adminRepo: any;

  function providerToken(overrides: any = {}) {
    providerRepo.findOne.mockResolvedValue({
      providerId: 'prov-1',
      email: 'p@x.com',
      isActive: true,
      isBlocked: false,
      ...overrides,
    });
    return signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });
  }

  function customerTokenValue() {
    customerRepo.findOne.mockResolvedValue({
      customerId: 'cust-1',
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });
  }

  beforeAll(async () => {
    providerRepo = mockRepo();
    providerServiceRepo = mockRepo();
    bookingRepo = mockRepo();
    customerRepo = mockRepo();
    adminRepo = mockRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ProvidersController],
      providers: [
        ProvidersService,
        BookingsService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(ProviderService), useValue: providerServiceRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
        {
          provide: MailService,
          useValue: {
            sendBookingConfirmation: jest.fn(),
            sendBookingCancellation: jest.fn(),
            sendBookingStatusUpdate: jest.fn(),
          },
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
  });

  // ---------- public directory ----------

  describe('GET /api/providers', () => {
    it('is public, no token needed', async () => {
      providerRepo.find.mockResolvedValue([{ providerId: 'p-1', providerName: 'Rajshahi Cleaners' }]);

      const res = await request(app.getHttpServer()).get('/api/providers').expect(200);

      expect(res.body).toHaveLength(1);
    });

    it('only lists active, unblocked providers', async () => {
      providerRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer()).get('/api/providers').expect(200);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.where.isActive).toBe(true);
      expect(options.where.isBlocked).toBe(false);
    });

    it('passes a name search through from the query string', async () => {
      providerRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer()).get('/api/providers?search=Cleaners').expect(200);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.where.providerName).toBeDefined();
    });

    it('rejects a minRating above 5 (400)', async () => {
      await request(app.getHttpServer()).get('/api/providers?minRating=9').expect(400);
    });
  });

  describe('GET /api/providers/:id', () => {
    it('returns the public profile with only the available services', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'p-1',
        providerName: 'Rajshahi Cleaners',
        providerServices: [
          {
            id: 'ps-1',
            serviceId: 's-1',
            price: 500,
            isAvailable: true,
            service: { serviceName: 'Home Cleaning' },
          },
          {
            id: 'ps-2',
            serviceId: 's-2',
            price: 800,
            isAvailable: false,
            service: { serviceName: 'AC Repair' },
          },
        ],
      });

      const res = await request(app.getHttpServer()).get('/api/providers/p-1').expect(200);

      expect(res.body.services).toHaveLength(1);
      expect(res.body.services[0].serviceName).toBe('Home Cleaning');
    });

    it('returns 404 for a provider that doesnt exist or is blocked', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/api/providers/ghost').expect(404);
    });
  });

  // ---------- who can reach the me/* routes ----------

  describe('authorisation on the provider workspace', () => {
    it('rejects a request with no token (401)', async () => {
      await request(app.getHttpServer()).get('/api/providers/me/profile').expect(401);
    });

    it('rejects a customer token on the provider workspace (403)', async () => {
      const token = customerTokenValue();

      await request(app.getHttpServer())
        .get('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects a customer trying to add a service listing (403)', async () => {
      const token = customerTokenValue();

      await request(app.getHttpServer())
        .post('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId: '3f0c8e42-9b7a-4d51-8f2e-1a2b3c4d5e6f', price: 500 })
        .expect(403);
    });

    it('rejects a token for a blocked provider (401)', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'prov-1',
        isActive: true,
        isBlocked: true,
      });
      const token = signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });

      await request(app.getHttpServer())
        .get('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  // ---------- own profile ----------

  describe('PUT /api/providers/me/profile', () => {
    it('updates the providers own profile', async () => {
      const token = providerToken({ providerName: 'Old Name', description: 'keep me' });

      const res = await request(app.getHttpServer())
        .put('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ providerName: 'New Name' })
        .expect(200);

      expect(res.body.providerName).toBe('New Name');
      expect(res.body.description).toBe('keep me');
    });

    it('rejects a field that isnt in the dto (400)', async () => {
      const token = providerToken();

      // Verification is an admin decision. A provider must not be able to tick
      // that flag for themselves by adding it to the request body.
      await request(app.getHttpServer())
        .put('/api/providers/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ providerName: 'Sneaky', isVerified: true })
        .expect(400);
    });
  });

  describe('PUT /api/providers/me/change-password', () => {
    it('changes the password when the current one is right', async () => {
      const passwordHash = await bcrypt.hash('OldPassword@1', 10);
      providerRepo.findOne.mockResolvedValue({
        providerId: 'prov-1',
        passwordHash,
        isActive: true,
        isBlocked: false,
      });
      const token = signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });

      await request(app.getHttpServer())
        .put('/api/providers/me/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPassword@1', newPassword: 'NewPassword@1' })
        .expect(200);
    });

    it('returns 401 when the current password is wrong', async () => {
      const passwordHash = await bcrypt.hash('OldPassword@1', 10);
      providerRepo.findOne.mockResolvedValue({
        providerId: 'prov-1',
        passwordHash,
        isActive: true,
        isBlocked: false,
      });
      const token = signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });

      await request(app.getHttpServer())
        .put('/api/providers/me/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPassword@1', newPassword: 'NewPassword@1' })
        .expect(401);
    });
  });

  // ---------- service listings ----------

  describe('POST /api/providers/me/services', () => {
    const serviceId = '3f0c8e42-9b7a-4d51-8f2e-1a2b3c4d5e6f';

    it('adds a new service listing with a price', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue(null);
      providerServiceRepo.save.mockImplementation(async (ps: any) => ({ ...ps, id: 'ps-1' }));

      const res = await request(app.getHttpServer())
        .post('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId, price: 500, description: 'deep clean' })
        .expect(201);

      expect(res.body.id).toBe('ps-1');
      // The listing has to be attached to the provider in the token, not to
      // whatever id someone puts in the body.
      expect(res.body.providerId).toBe('prov-1');
    });

    it('returns 409 when the provider already lists that service', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-existing' });

      await request(app.getHttpServer())
        .post('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId, price: 500 })
        .expect(409);
    });

    it('rejects a serviceId that isnt a uuid (400)', async () => {
      const token = providerToken();

      await request(app.getHttpServer())
        .post('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId: 'not-a-uuid', price: 500 })
        .expect(400);
    });

    it('rejects a negative price (400)', async () => {
      const token = providerToken();

      await request(app.getHttpServer())
        .post('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId, price: -50 })
        .expect(400);
    });
  });

  describe('PUT /api/providers/me/services/:serviceId', () => {
    it('updates the price on the providers own listing', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue({
        id: 'ps-1',
        providerId: 'prov-1',
        price: 500,
      });

      const res = await request(app.getHttpServer())
        .put('/api/providers/me/services/ps-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 650 })
        .expect(200);

      expect(res.body.price).toBe(650);
    });

    it('can pause a listing by setting isAvailable false', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue({
        id: 'ps-1',
        providerId: 'prov-1',
        isAvailable: true,
      });

      const res = await request(app.getHttpServer())
        .put('/api/providers/me/services/ps-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ isAvailable: false })
        .expect(200);

      expect(res.body.isAvailable).toBe(false);
    });

    it('returns 404 when the listing belongs to a different provider', async () => {
      const token = providerToken();
      // The lookup filters on providerId too, so another provider's listing comes
      // back null and we get a 404.
      providerServiceRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .put('/api/providers/me/services/ps-someone-else')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 1 })
        .expect(404);
    });
  });

  describe('DELETE /api/providers/me/services/:serviceId', () => {
    it('removes the providers own listing', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-1', providerId: 'prov-1' });

      await request(app.getHttpServer())
        .delete('/api/providers/me/services/ps-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(providerServiceRepo.remove).toHaveBeenCalled();
    });

    it('returns 404 when trying to delete someone elses listing', async () => {
      const token = providerToken();
      providerServiceRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/providers/me/services/ps-someone-else')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(providerServiceRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/providers/me/services', () => {
    it('returns paused listings too, not just the live ones', async () => {
      const token = providerToken();
      providerServiceRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/providers/me/services')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const [options] = providerServiceRepo.find.mock.calls[0];
      expect(options.where.isAvailable).toBeUndefined();
    });
  });

  // ---------- provider bookings ----------

  describe('PUT /api/providers/me/bookings/:bookingId/status', () => {
    function bookingFor(providerId: string, status: BookingStatus) {
      return {
        bookingId: 'b-1',
        customerId: 'cust-1',
        status,
        providerService: { providerId },
      };
    }

    it('lets the provider confirm a pending booking', async () => {
      const token = providerToken();
      bookingRepo.findOne.mockResolvedValue(bookingFor('prov-1', BookingStatus.PENDING));

      const res = await request(app.getHttpServer())
        .put('/api/providers/me/bookings/b-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(res.body.status).toBe(BookingStatus.CONFIRMED);
    });

    it('blocks skipping straight from pending to completed (400)', async () => {
      const token = providerToken();
      bookingRepo.findOne.mockResolvedValue(bookingFor('prov-1', BookingStatus.PENDING));

      await request(app.getHttpServer())
        .put('/api/providers/me/bookings/b-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' })
        .expect(400);
    });

    it('blocks a provider touching another providers booking (403)', async () => {
      const token = providerToken();
      bookingRepo.findOne.mockResolvedValue(bookingFor('prov-2', BookingStatus.PENDING));

      await request(app.getHttpServer())
        .put('/api/providers/me/bookings/b-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'confirmed' })
        .expect(403);
    });
  });
});
