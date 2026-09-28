// Integration tests for the admin endpoints.
// These boot a real Nest app and hit it over HTTP with supertest, so a request goes through the actual JwtAuthGuard, the actual RolesGuard and the actual validation pipe. Only the database is mocked.
// The authorisation tests are the ones I'd point at if someone asked what this file is for. These routes can suspend people and read every customer record,so I want proof that a customer or provider token can't get anywhere nearthem, not just an assumption that the guard is doing its job.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { AdminsController } from '../src/modules/admins/admins.controller';
import { AdminsService } from '../src/modules/admins/admins.service';
import { Admin, AdminRole } from '../src/modules/admins/entities/admin.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Booking } from '../src/modules/bookings/entities/booking.entity';
import { Payment } from '../src/modules/payments/entities/payment.entity';
import { Review } from '../src/modules/reviews/entities/review.entity';
import { BlockReport } from '../src/modules/reports/entities/block-report.entity';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

describe('Admin endpoints (integration)', () => {
  let app: INestApplication;
  let adminRepo: any;
  let customerRepo: any;
  let providerRepo: any;
  let bookingRepo: any;
  let paymentRepo: any;
  let reviewRepo: any;
  let reportRepo: any;

  // A signed in admin. The JWT strategy looks the admin up by id, then the
  // RolesGuard checks the role field on whatever record comes back.
  function adminToken() {
    adminRepo.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@servicehub.local',
      role: AdminRole.ADMIN,
      isActive: true,
    });
    return signTestToken({ sub: 'admin-1', email: 'admin@servicehub.local', userType: 'admin' });
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
    adminRepo = mockRepo();
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    bookingRepo = mockRepo();
    paymentRepo = mockRepo();
    reviewRepo = mockRepo();
    reportRepo = mockRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AdminsController],
      providers: [
        AdminsService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(BlockReport), useValue: reportRepo },
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

  // ---------- authorisation ----------

  describe('who can reach the admin routes', () => {
    it('rejects a request with no token at all (401)', async () => {
      await request(app.getHttpServer()).get('/api/admins/dashboard').expect(401);
    });

    it('rejects a made up token (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/admins/dashboard')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('rejects a signed in customer trying to open the admin dashboard (403)', async () => {
      const token = customerTokenValue();

      await request(app.getHttpServer())
        .get('/api/admins/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects a customer trying to read the full customer list (403)', async () => {
      const token = customerTokenValue();

      await request(app.getHttpServer())
        .get('/api/admins/customers')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects a customer trying to suspend another user (403)', async () => {
      const token = customerTokenValue();

      await request(app.getHttpServer())
        .post('/api/admins/users/customer/cust-2/suspend')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'because i said so' })
        .expect(403);
    });

    it('rejects a token for an admin whose account was deactivated (401)', async () => {
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        role: AdminRole.ADMIN,
        isActive: false,
      });
      const token = signTestToken({
        sub: 'admin-1',
        email: 'admin@servicehub.local',
        userType: 'admin',
      });

      await request(app.getHttpServer())
        .get('/api/admins/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  // ---------- dashboard ----------

  describe('GET /api/admins/dashboard', () => {
    function stubDashboard() {
      customerRepo.count.mockResolvedValue(25);
      providerRepo.count.mockResolvedValue(8);
      bookingRepo.count
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(30);
      reportRepo.count.mockResolvedValue(2);
      paymentRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '12500.50' }),
      });
      bookingRepo.find.mockResolvedValue([]);
      reviewRepo.find.mockResolvedValue([]);
    }

    it('returns the dashboard stats for a signed in admin', async () => {
      const token = adminToken();
      stubDashboard();

      const res = await request(app.getHttpServer())
        .get('/api/admins/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.totalCustomers).toBe(25);
      expect(res.body.totalProviders).toBe(8);
      expect(res.body.totalRevenue).toBe(12500.5);
    });
  });

  // ---------- user lists ----------

  describe('GET /api/admins/customers', () => {
    it('returns the paginated customer list', async () => {
      const token = adminToken();
      customerRepo.findAndCount.mockResolvedValue([[{ customerId: 'c-1', name: 'Test' }], 1]);

      const res = await request(app.getHttpServer())
        .get('/api/admins/customers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
    });

    it('passes the page and limit from the query string through', async () => {
      const token = adminToken();
      customerRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app.getHttpServer())
        .get('/api/admins/customers?page=2&limit=5')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(customerRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  describe('GET /api/admins/providers', () => {
    it('returns the paginated provider list', async () => {
      const token = adminToken();
      providerRepo.findAndCount.mockResolvedValue([[{ providerId: 'p-1' }], 1]);

      const res = await request(app.getHttpServer())
        .get('/api/admins/providers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(1);
    });
  });

  // ---------- provider verification ----------

  describe('POST /api/admins/providers/:id/verify', () => {
    it('verifies a provider', async () => {
      const token = adminToken();
      providerRepo.findOne.mockResolvedValue({
        providerId: 'p-1',
        isVerified: false,
        isActive: false,
      });

      const res = await request(app.getHttpServer())
        .post('/api/admins/providers/p-1/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body.isVerified).toBe(true);
      expect(res.body.isActive).toBe(true);
    });

    it('returns 404 for a provider that doesnt exist', async () => {
      const token = adminToken();
      providerRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/admins/providers/ghost/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ---------- suspend and reinstate ----------

  describe('POST /api/admins/users/:userType/:id/suspend', () => {
    it('suspends a customer', async () => {
      const token = adminToken();
      const customer = { customerId: 'cust-2', isBlocked: false, isActive: true };
      customerRepo.findOne.mockResolvedValue(customer);

      await request(app.getHttpServer())
        .post('/api/admins/users/customer/cust-2/suspend')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'repeated no shows' })
        .expect(201);

      expect(customer.isBlocked).toBe(true);
      expect(customer.isActive).toBe(false);
    });

    it('suspends a provider', async () => {
      const token = adminToken();
      const provider = { providerId: 'p-2', isBlocked: false, isActive: true };
      providerRepo.findOne.mockResolvedValue(provider);

      await request(app.getHttpServer())
        .post('/api/admins/users/provider/p-2/suspend')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'fake listings' })
        .expect(201);

      expect(provider.isBlocked).toBe(true);
    });

    it('returns 404 when suspending someone who doesnt exist', async () => {
      const token = adminToken();
      customerRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/admins/users/customer/ghost/suspend')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'x' })
        .expect(404);
    });
  });

  describe('POST /api/admins/users/:userType/:id/activate', () => {
    it('reinstates a suspended customer', async () => {
      const token = adminToken();
      const customer = { customerId: 'cust-2', isBlocked: true, isActive: false };
      customerRepo.findOne.mockResolvedValue(customer);

      await request(app.getHttpServer())
        .post('/api/admins/users/customer/cust-2/activate')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(customer.isBlocked).toBe(false);
      expect(customer.isActive).toBe(true);
    });
  });

  // ---------- creating admins ----------

  describe('POST /api/admins', () => {
    it('creates a new admin', async () => {
      const token = adminToken();
      // Two lookups again. First is the JWT strategy checking who I am, second is
      // the duplicate email check inside the service.
      adminRepo.findOne
        .mockResolvedValueOnce({ id: 'admin-1', role: AdminRole.ADMIN, isActive: true })
        .mockResolvedValueOnce(null);
      adminRepo.save.mockImplementation(async (a: any) => ({ ...a, id: 'admin-2' }));

      const res = await request(app.getHttpServer())
        .post('/api/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Second Admin',
          email: 'second@servicehub.local',
          password: 'Password@123',
        })
        .expect(201);

      expect(res.body.id).toBe('admin-2');
    });

    it('rejects a badly formatted email through the validation pipe (400)', async () => {
      const token = adminToken();

      await request(app.getHttpServer())
        .post('/api/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', email: 'not-an-email', password: 'Password@123' })
        .expect(400);
    });

    it('rejects a password under 8 characters (400)', async () => {
      const token = adminToken();

      await request(app.getHttpServer())
        .post('/api/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', email: 'ok@servicehub.local', password: 'short' })
        .expect(400);
    });

    it('rejects unexpected extra fields (400)', async () => {
      const token = adminToken();

      await request(app.getHttpServer())
        .post('/api/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sneaky',
          email: 'ok@servicehub.local',
          password: 'Password@123',
          isActive: true,
        })
        .expect(400);
    });

    it('returns 409 when that admin email is already taken', async () => {
      const token = adminToken();
      adminRepo.findOne
        .mockResolvedValueOnce({ id: 'admin-1', role: AdminRole.ADMIN, isActive: true })
        .mockResolvedValueOnce({ id: 'existing' });

      await request(app.getHttpServer())
        .post('/api/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Duplicate',
          email: 'taken@servicehub.local',
          password: 'Password@123',
        })
        .expect(409);
    });
  });

  // ---------- admin record ----------

  describe('GET /api/admins/:id', () => {
    it('returns 404 for an admin id that doesnt exist', async () => {
      const token = adminToken();
      adminRepo.findOne
        .mockResolvedValueOnce({ id: 'admin-1', role: AdminRole.ADMIN, isActive: true })
        .mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get('/api/admins/ghost')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
