// Integration tests for the customer profile endpoints.
// Real Nest app, real JwtAuthGuard and CustomerGuard, real validation pipe. Only the database is mocked.
// The guard tests matter a lot here because every route on this controller reads or changes the signed in customer's own data, so a provider or admin token must not get through.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';

import { CustomersController } from '../src/modules/customers/customers.controller';
import { CustomersService } from '../src/modules/customers/customers.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { ProviderService } from '../src/modules/providers/entities/provider-service.entity';
import { Booking } from '../src/modules/bookings/entities/booking.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

describe('Customer endpoints (integration)', () => {
  let app: INestApplication;
  let customerRepo: any;
  let providerRepo: any;
  let adminRepo: any;
  let bookingRepo: any;
  let providerServiceRepo: any;

  // Signs in as cust-1. The JWT strategy looks the customer up and checks they
  // are active and not blocked before anything else runs.
  function customerToken(overrides: any = {}) {
    customerRepo.findOne.mockResolvedValue({
      customerId: 'cust-1',
      email: 'c@x.com',
      isActive: true,
      isBlocked: false,
      ...overrides,
    });
    return signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });
  }

  function providerTokenValue() {
    providerRepo.findOne.mockResolvedValue({
      providerId: 'prov-1',
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });
  }

  beforeAll(async () => {
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    adminRepo = mockRepo();
    bookingRepo = mockRepo();
    providerServiceRepo = mockRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [CustomersController],
      providers: [
        CustomersService,
        BookingsService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(ProviderService), useValue: providerServiceRepo },
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

  // ---------- who can reach these routes ----------

  describe('authorisation', () => {
    it('rejects a request with no token (401)', async () => {
      await request(app.getHttpServer()).get('/api/customers/profile').expect(401);
    });

    it('rejects a provider token on a customer route (403)', async () => {
      const token = providerTokenValue();

      await request(app.getHttpServer())
        .get('/api/customers/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects a token for a blocked customer (401)', async () => {
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        isActive: true,
        isBlocked: true,
      });
      const token = signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });

      await request(app.getHttpServer())
        .get('/api/customers/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('rejects a token for a deactivated customer (401)', async () => {
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        isActive: false,
        isBlocked: false,
      });
      const token = signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });

      await request(app.getHttpServer())
        .get('/api/customers/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  // ---------- profile ----------

  describe('GET /api/customers/profile', () => {
    it('returns the signed in customers profile', async () => {
      const token = customerToken();

      const res = await request(app.getHttpServer())
        .get('/api/customers/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.customerId).toBe('cust-1');
    });

    it('reads the customer id from the token, not from the request', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .get('/api/customers/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // The lookup should use the id from the token. If it ever read an id from
      // the request instead, anyone could pull up anyone else's profile.
      const calls = customerRepo.findOne.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.where.customerId).toBe('cust-1');
    });
  });

  describe('PUT /api/customers/profile', () => {
    it('updates the profile and returns the new values', async () => {
      const token = customerToken({ name: 'Old Name', address: 'Boalia' });

      const res = await request(app.getHttpServer())
        .put('/api/customers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
      expect(res.body.address).toBe('Boalia');
    });

    it('rejects a field that isnt in the dto (400)', async () => {
      const token = customerToken();

      // forbidNonWhitelisted is on in the validation pipe, so trying to slip
      // isBlocked or customerId into the body gets rejected outright rather than
      // quietly ignored.
      await request(app.getHttpServer())
        .put('/api/customers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sneaky', isBlocked: false })
        .expect(400);
    });

    it('rejects a wrongly typed field (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .put('/api/customers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ age: 'not a number' })
        .expect(400);
    });
  });

  // ---------- change password ----------

  describe('PUT /api/customers/change-password', () => {
    it('changes the password when the current one is right', async () => {
      const passwordHash = await bcrypt.hash('OldPassword@1', 10);
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        passwordHash,
        isActive: true,
        isBlocked: false,
      });
      const token = signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });

      const res = await request(app.getHttpServer())
        .put('/api/customers/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPassword@1', newPassword: 'NewPassword@1' })
        .expect(200);

      expect(res.body.message).toContain('changed');
    });

    it('returns 401 when the current password is wrong', async () => {
      const passwordHash = await bcrypt.hash('OldPassword@1', 10);
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        passwordHash,
        isActive: true,
        isBlocked: false,
      });
      const token = signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });

      await request(app.getHttpServer())
        .put('/api/customers/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPassword@1', newPassword: 'NewPassword@1' })
        .expect(401);
    });

    it('rejects a new password under 8 characters (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .put('/api/customers/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPassword@1', newPassword: 'Ab1!' })
        .expect(400);
    });

    it('rejects a new password with no uppercase or number (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .put('/api/customers/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPassword@1', newPassword: 'alllowercase' })
        .expect(400);
    });
  });

  // ---------- bookings and account ----------

  describe('GET /api/customers/bookings', () => {
    it('returns only the signed in customers bookings', async () => {
      const token = customerToken();
      bookingRepo.find.mockResolvedValue([{ bookingId: 'b-1', customerId: 'cust-1' }]);

      const res = await request(app.getHttpServer())
        .get('/api/customers/bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      // The query has to be scoped to the customer id in the token.
      const [options] = bookingRepo.find.mock.calls[0];
      expect(options.where.customerId).toBe('cust-1');
    });
  });

  describe('DELETE /api/customers/account', () => {
    it('deactivates the account rather than deleting the row', async () => {
      const customer: any = {
        customerId: 'cust-1',
        isActive: true,
        isBlocked: false,
      };
      customerRepo.findOne.mockResolvedValue(customer);
      const token = signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });

      await request(app.getHttpServer())
        .delete('/api/customers/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(customer.isActive).toBe(false);
      // Nothing should actually be deleted. The booking history needs to survive
      // so the admin can still see it.
      expect(customerRepo.remove).not.toHaveBeenCalled();
    });
  });
});
