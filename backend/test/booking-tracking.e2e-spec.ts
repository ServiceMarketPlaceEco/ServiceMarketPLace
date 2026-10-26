// Integration test for the full status-tracking journey, as one story:
// customer books -> admin assigns a provider -> provider starts and finishes the
// job -> at every step the customer reads the booking and sees the new status.
// This is the data the customer's "Track your booking" page shows.
//
// Unlike the other e2e files, the booking repo here is a small in-memory store,
// so each request really sees what the previous one saved.
// Real Nest app, real guards, real validation pipe.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { BookingsController } from '../src/modules/bookings/bookings.controller';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { ProvidersController } from '../src/modules/providers/providers.controller';
import { ProvidersService } from '../src/modules/providers/providers.service';
import { Booking } from '../src/modules/bookings/entities/booking.entity';
import { ProviderService } from '../src/modules/providers/entities/provider-service.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

const OFFERING = { id: 'ps-1', providerId: 'prov-1', serviceId: 'svc-cleaning', price: 600, isAvailable: true };

describe('Booking status tracking journey (integration)', () => {
  let app: INestApplication;
  let store: Map<string, any>;
  let bookingRepo: any;
  let providerServiceRepo: any;
  let customerRepo: any;
  let providerRepo: any;
  let adminRepo: any;
  let mail: any;
  let nextId = 1;

  const tokens = {
    customer: () => signTestToken({ sub: 'cust-1', email: 'c1@x.com', userType: 'customer' }),
    otherCustomer: () => signTestToken({ sub: 'cust-2', email: 'c2@x.com', userType: 'customer' }),
    provider: () => signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' }),
    admin: () => signTestToken({ sub: 'admin-1', email: 'a@x.com', userType: 'admin' }),
  };

  // Attach the provider offering the way TypeORM would load the relation.
  const withRelations = (b: any) =>
    b && { ...b, providerService: b.providerServiceId === OFFERING.id ? { ...OFFERING } : null };

  beforeAll(async () => {
    store = new Map();
    bookingRepo = {
      ...mockRepo(),
      save: jest.fn(async (b: any) => {
        const saved = { ...b, bookingId: b.bookingId ?? `bk-${nextId++}` };
        delete saved.providerService;
        store.set(saved.bookingId, saved);
        return withRelations(saved);
      }),
      findOne: jest.fn(async ({ where }: any) => withRelations(store.get(where.bookingId))),
      find: jest.fn(async ({ where }: any = {}) =>
        [...store.values()].filter((b) => !where?.customerId || b.customerId === where.customerId).map(withRelations),
      ),
      // The provider job list uses a query builder; this one just filters the
      // store by the provider's offering ids.
      createQueryBuilder: jest.fn(() => {
        let ids: string[] = [];
        const qb: any = {
          leftJoinAndSelect: () => qb,
          where: (_sql: string, params: any) => ((ids = params.serviceIds), qb),
          andWhere: () => qb,
          orderBy: () => qb,
          addOrderBy: () => qb,
          getMany: async () => [...store.values()].filter((b) => ids.includes(b.providerServiceId)).map(withRelations),
        };
        return qb;
      }),
    };
    providerServiceRepo = {
      ...mockRepo(),
      findOne: jest.fn(async ({ where }: any) =>
        where.providerId === OFFERING.providerId && where.serviceId === OFFERING.serviceId ? { ...OFFERING } : null,
      ),
      find: jest.fn(async () => [{ id: OFFERING.id }]),
    };
    // Every account in this story is active, so the JWT strategy lets them in.
    customerRepo = { ...mockRepo(), findOne: jest.fn(async () => ({ isActive: true, isBlocked: false })) };
    providerRepo = { ...mockRepo(), findOne: jest.fn(async () => ({ isActive: true, isBlocked: false })) };
    adminRepo = { ...mockRepo(), findOne: jest.fn(async () => ({ id: 'admin-1', isActive: true, role: 'admin' })) };
    mail = { sendBookingConfirmation: jest.fn(), sendBookingCancellation: jest.fn(), sendBookingStatusUpdate: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [BookingsController, ProvidersController],
      providers: [
        BookingsService,
        ProvidersService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(ProviderService), useValue: providerServiceRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    applyMainConfig(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const statusSeenByCustomer = async (id: string) =>
    (await request(server()).get(`/api/bookings/${id}`).set('Authorization', `Bearer ${tokens.customer()}`).expect(200)).body
      .status;

  it('moves through every tracking stage and the customer sees each one', async () => {
    // 1. The customer books a cleaning job without choosing a provider.
    const created = await request(server())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer()}`)
      .send({ serviceId: 'svc-cleaning', serviceName: 'Home Cleaning', date: '2026-11-02', time: '10:00', address: 'Boalia' })
      .expect(201);
    const id = created.body.bookingId;
    expect(await statusSeenByCustomer(id)).toBe('pending'); // "Request received"

    // 2. The admin assigns prov-1 and accepts the booking.
    const assigned = await request(server())
      .patch(`/api/bookings/${id}/status`)
      .set('Authorization', `Bearer ${tokens.admin()}`)
      .send({ status: 'Accepted', providerId: 'prov-1' })
      .expect(200);
    expect(assigned.body).toMatchObject({ providerServiceId: 'ps-1', totalAmount: 600 });
    expect(await statusSeenByCustomer(id)).toBe('confirmed'); // "Provider assigned"

    // 3. The provider sees the job and starts it.
    const jobs = await request(server())
      .get('/api/providers/me/bookings')
      .set('Authorization', `Bearer ${tokens.provider()}`)
      .expect(200);
    // The newly assigned job now shows up in the provider's list.
    expect(jobs.body.map((b: any) => b.bookingId)).toContain(id);

    await request(server())
      .put(`/api/providers/me/bookings/${id}/status`)
      .set('Authorization', `Bearer ${tokens.provider()}`)
      .send({ status: 'in_progress' })
      .expect(200);
    expect(await statusSeenByCustomer(id)).toBe('in_progress'); // "Service in progress"

    // 4. The provider finishes the job.
    await request(server())
      .put(`/api/providers/me/bookings/${id}/status`)
      .set('Authorization', `Bearer ${tokens.provider()}`)
      .send({ status: 'completed' })
      .expect(200);
    expect(await statusSeenByCustomer(id)).toBe('completed'); // "Service completed"

    // Each provider step sent a status update notification.
    expect(mail.sendBookingStatusUpdate).toHaveBeenCalledTimes(2);
  });

  it('does not let the provider skip a stage', async () => {
    const created = await request(server())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer()}`)
      .send({ serviceId: 'svc-cleaning', date: '2026-11-03', time: '11:00' })
      .expect(201);
    const id = created.body.bookingId;
    await request(server())
      .patch(`/api/bookings/${id}/status`)
      .set('Authorization', `Bearer ${tokens.admin()}`)
      .send({ status: 'confirmed', providerId: 'prov-1' })
      .expect(200);

    // confirmed -> completed skips "in progress", so it is refused
    await request(server())
      .put(`/api/providers/me/bookings/${id}/status`)
      .set('Authorization', `Bearer ${tokens.provider()}`)
      .send({ status: 'completed' })
      .expect(400);
    expect(await statusSeenByCustomer(id)).toBe('confirmed');
  });

  it('shows a cancelled booking as cancelled when the customer cancels it', async () => {
    const created = await request(server())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer()}`)
      .send({ serviceId: 'svc-cleaning', date: '2026-11-04', time: '09:00' })
      .expect(201);
    const id = created.body.bookingId;

    await request(server())
      .put(`/api/bookings/${id}/cancel`)
      .set('Authorization', `Bearer ${tokens.customer()}`)
      .expect(200);

    expect(await statusSeenByCustomer(id)).toBe('cancelled');
  });

  it('lets the customer change a pending booking before it is accepted', async () => {
    const created = await request(server())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer()}`)
      .send({ serviceId: 'svc-cleaning', date: '2026-11-05', time: '09:00' })
      .expect(201);

    const res = await request(server())
      .put(`/api/bookings/${created.body.bookingId}`)
      .set('Authorization', `Bearer ${tokens.customer()}`)
      .send({ time: '14:00', notes: 'Please call when outside' })
      .expect(200);

    expect(res.body).toMatchObject({ time: '14:00', notes: 'Please call when outside' });
  });

  it('never shows one customers booking to another customer', async () => {
    const created = await request(server())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer()}`)
      .send({ serviceId: 'svc-cleaning', date: '2026-11-06', time: '09:00', address: 'Private address' })
      .expect(201);

    const res = await request(server())
      .get(`/api/bookings/${created.body.bookingId}`)
      .set('Authorization', `Bearer ${tokens.otherCustomer()}`);

    // Today this comes back as 200 { error: 'Access denied' } (see the QA report);
    // a 403 would be better. Either way, none of the booking may leak.
    expect([200, 403]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain('Private address');
    expect(res.body.bookingId).toBeUndefined();
  });

  it('lets an admin list every booking through the protected admin route', async () => {
    // Makes its own booking so it does not depend on the order the tests run in.
    const created = await request(server())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer()}`)
      .send({ serviceId: 'svc-cleaning', date: '2026-11-07', time: '09:00' })
      .expect(201);

    const res = await request(server()).get('/api/bookings').set('Authorization', `Bearer ${tokens.admin()}`).expect(200);

    expect(res.body.map((b: any) => b.bookingId)).toContain(created.body.bookingId);
  });

  it('keeps the protected admin list away from customers', async () => {
    await request(server()).get('/api/bookings').set('Authorization', `Bearer ${tokens.customer()}`).expect(403);
  });
});
