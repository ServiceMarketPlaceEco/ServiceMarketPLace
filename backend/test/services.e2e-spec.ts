

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';

import { ServicesController } from '../src/modules/services/services.controller';
import { ServicesService } from '../src/modules/services/services.service';
import { ServiceMatchingService } from '../src/modules/services/matching/service-matching.service';
import { Service } from '../src/modules/services/entities/service.entity';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

// low limit so the rate limit test doesnt need dozens of requests
const MATCH_RATE_LIMIT = 3;

describe('Services endpoints (integration)', () => {
  let app: INestApplication;
  let serviceRepo: any;
  let customerRepo: any;
  let adminRepo: any;

  beforeAll(async () => {
    serviceRepo = mockRepo();
    customerRepo = mockRepo();
    adminRepo = mockRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: MATCH_RATE_LIMIT }])],
      controllers: [ServicesController],
      providers: [
        ServicesService,
        ServiceMatchingService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(Service), useValue: serviceRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: mockRepo() },
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
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

  describe('GET /api/services (public)', () => {
    it('returns the active services list, no token needed', async () => {
      serviceRepo.find.mockResolvedValue([
        { serviceId: 's-1', serviceName: 'Home Cleaning', isActive: true },
      ]);

      const res = await request(app.getHttpServer()).get('/api/services').expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].serviceName).toBe('Home Cleaning');
    });
  });

  describe('GET /api/services/:id', () => {
    it('returns 404 for a service that doesnt exist', async () => {
      serviceRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/api/services/ghost-id').expect(404);
    });
  });

  describe('GET /api/services/:id/providers', () => {
    it('only returns providers that are available and not blocked', async () => {
      serviceRepo.findOne.mockResolvedValue({
        serviceId: 's-1',
        providerServices: [
          {
            id: 'ps-1',
            isAvailable: true,
            price: 500,
            provider: { providerId: 'p1', providerName: 'Good Provider', isActive: true, isBlocked: false },
          },
          {
            id: 'ps-2',
            isAvailable: true,
            price: 400,
            provider: { providerId: 'p2', providerName: 'Blocked Provider', isActive: true, isBlocked: true },
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/api/services/s-1/providers')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].providerName).toBe('Good Provider');
    });
  });

  describe('POST /api/services (admin only)', () => {
    const newService = { serviceName: 'Gardening', description: 'Garden work', icon: 'home' };

    it('returns 401 with no token at all', async () => {
      await request(app.getHttpServer()).post('/api/services').send(newService).expect(401);
    });

    it('returns 401 with a token thats just made up garbage', async () => {
      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', 'Bearer not.a.real.token')
        .send(newService)
        .expect(401);
    });

    it('returns 403 when a customer token tries an admin route', async () => {
      // real customer jwt, JwtStrategy loads them fine, then AdminGuard says no
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        isActive: true,
        isBlocked: false,
      });
      const token = signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });

      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${token}`)
        .send(newService)
        .expect(403);
    });

    it('lets an admin create a service, returns 201', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', isActive: true });
      const token = signTestToken({ sub: 'admin-1', email: 'a@x.com', userType: 'admin' });

      const res = await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${token}`)
        .send(newService)
        .expect(201);

      expect(res.body.serviceName).toBe('Gardening');
      expect(serviceRepo.save).toHaveBeenCalled();
    });

    it('returns 401 when the account behind the token is blocked', async () => {
      // token is valid but JwtStrategy checks the account status too
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        isActive: true,
        isBlocked: true,
      });
      const token = signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });

      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${token}`)
        .send(newService)
        .expect(401);
    });

    it('returns 400 for an admin sending an invalid body', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', isActive: true });
      const token = signTestToken({ sub: 'admin-1', email: 'a@x.com', userType: 'admin' });

      // serviceName is required so an empty body should fail validation
      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });
  });

  // testConfigService has no OPENAI_API_KEY, so these exercise the rule
  // based matcher end to end. keep this block last: it uses up the rate limit.
  describe('POST /api/services/match-transcript (public, rate limited)', () => {
    const catalog = [
      { serviceId: 's-ac', serviceName: 'AC Repair', description: 'AC servicing, cooling issue checks and installation help.' },
      { serviceId: 's-plumb', serviceName: 'Plumbing Help', description: 'Tap leaks, pipe issues, bathroom fittings and drainage help.' },
    ];

    it('ranks services by what the customer meant', async () => {
      serviceRepo.find.mockResolvedValue(catalog);

      const res = await request(app.getHttpServer())
        .post('/api/services/match-transcript')
        .send({ transcript: 'my aircon is blowing warm air', language: 'en-AU' })
        .expect(200);

      expect(res.body.source).toBe('rules');
      expect(res.body.matches[0]).toMatchObject({ serviceId: 's-ac', serviceName: 'AC Repair' });
    });

    it('returns 400 for an empty transcript or unknown language', async () => {
      await request(app.getHttpServer())
        .post('/api/services/match-transcript')
        .send({ transcript: '' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/services/match-transcript')
        .send({ transcript: 'leaking tap', language: 'fr-FR' })
        .expect(400);
    });

    it(`returns 429 after ${MATCH_RATE_LIMIT} requests in the window`, async () => {
      serviceRepo.find.mockResolvedValue(catalog);
      // the earlier tests in this block already used up the limit
      await request(app.getHttpServer())
        .post('/api/services/match-transcript')
        .send({ transcript: 'leaking tap' })
        .expect(429);
    });

    it('does not rate limit the normal catalog routes', async () => {
      serviceRepo.find.mockResolvedValue(catalog);
      for (let i = 0; i < MATCH_RATE_LIMIT + 2; i++) {
        await request(app.getHttpServer()).get('/api/services').expect(200);
      }
    });
  });
});
