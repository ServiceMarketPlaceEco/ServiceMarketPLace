// Integration test for customer <-> provider chat, as one story:
// provider asks to chat -> blocked until admin approves -> admin approves ->
// both sides message each other -> outsiders can't read or write -> admin
// closes the chat again.
//
// Approvals and messages live in small in-memory stores so each request sees
// what the previous one saved. Real Nest app, real JWT guards, real validation.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { ChatController } from '../src/modules/chat/chat.controller';
import { ChatService } from '../src/modules/chat/chat.service';
import { ChatApproval } from '../src/modules/chat/entities/chat-approval.entity';
import { ChatMessage } from '../src/modules/chat/entities/chat-message.entity';
import { Booking } from '../src/modules/bookings/entities/booking.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

const BOOKINGS: Record<string, any> = {
  'bk-1': {
    bookingId: 'bk-1',
    customerId: 'cust-1',
    providerServiceId: 'ps-1',
    status: 'confirmed',
    serviceName: 'Home Cleaning',
    customer: { name: 'Rahim', passwordHash: 'hash' },
    providerService: { providerId: 'prov-1', provider: { providerName: 'Karim Services', passwordHash: 'hash' } },
  },
  // no provider assigned yet
  'bk-2': { bookingId: 'bk-2', customerId: 'cust-1', providerServiceId: null, status: 'pending', providerService: null },
};

describe('Customer <-> provider chat (integration)', () => {
  let app: INestApplication;
  const approvals = new Map<string, any>();
  const messages: any[] = [];
  let nextId = 1;

  const tokens = {
    customer: signTestToken({ sub: 'cust-1', email: 'c1@x.com', userType: 'customer' }),
    otherCustomer: signTestToken({ sub: 'cust-2', email: 'c2@x.com', userType: 'customer' }),
    provider: signTestToken({ sub: 'prov-1', email: 'p1@x.com', userType: 'provider' }),
    otherProvider: signTestToken({ sub: 'prov-2', email: 'p2@x.com', userType: 'provider' }),
    admin: signTestToken({ sub: 'admin-1', email: 'a@x.com', userType: 'admin' }),
  };

  beforeAll(async () => {
    const approvalRepo = {
      ...mockRepo(),
      findOne: jest.fn(async ({ where }: any) => {
        const found = where.id
          ? approvals.get(where.id)
          : [...approvals.values()].find((a) => a.bookingId === where.bookingId);
        return found && { ...found, booking: BOOKINGS[found.bookingId] };
      }),
      save: jest.fn(async (a: any) => {
        const saved = { ...a, id: a.id ?? `ap-${nextId++}`, createdAt: a.createdAt ?? new Date(), updatedAt: new Date() };
        delete saved.booking;
        approvals.set(saved.id, saved);
        return { ...saved };
      }),
      createQueryBuilder: jest.fn(() => {
        const qb: any = {};
        for (const m of ['innerJoinAndSelect', 'leftJoinAndSelect', 'where', 'orderBy']) qb[m] = () => qb;
        qb.getMany = async () => [...approvals.values()].map((a) => ({ ...a, booking: BOOKINGS[a.bookingId] }));
        return qb;
      }),
    };
    const messageRepo = {
      ...mockRepo(),
      find: jest.fn(async ({ where }: any) => messages.filter((m) => m.bookingId === where.bookingId)),
      save: jest.fn(async (m: any) => {
        const saved = { ...m, id: `msg-${nextId++}`, createdAt: new Date() };
        messages.push(saved);
        return saved;
      }),
    };
    const bookingRepo = { ...mockRepo(), findOne: jest.fn(async ({ where }: any) => BOOKINGS[where.bookingId] ?? null) };
    const activeAccount = { ...mockRepo(), findOne: jest.fn(async () => ({ id: 'admin-1', isActive: true, isBlocked: false, isVerified: true, role: 'admin' })) };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ChatController],
      providers: [
        ChatService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(ChatApproval), useValue: approvalRepo },
        { provide: getRepositoryToken(ChatMessage), useValue: messageRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Customer), useValue: activeAccount },
        { provide: getRepositoryToken(ServiceProvider), useValue: activeAccount },
        { provide: getRepositoryToken(Admin), useValue: activeAccount },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    applyMainConfig(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const as = (token: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${token}`),
  });

  it('needs a login', async () => {
    await request(app.getHttpServer()).get('/api/chat/approvals').expect(401);
    await request(app.getHttpServer()).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'hi' }).expect(401);
  });

  it('runs the whole chat journey', async () => {
    // 1. Before anything is approved, nobody can send.
    await as(tokens.customer).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'hello?' }).expect(403);

    // 2. Chat can't be requested before a provider is assigned.
    await as(tokens.customer).post('/api/chat/approvals').send({ bookingId: 'bk-2' }).expect(400);

    // 3. An outsider can't request chat on someone else's booking.
    await as(tokens.otherProvider).post('/api/chat/approvals').send({ bookingId: 'bk-1' }).expect(403);

    // 4. The provider asks for chat.
    const requested = await as(tokens.provider).post('/api/chat/approvals').send({ bookingId: 'bk-1' }).expect(201);
    expect(requested.body).toMatchObject({ bookingId: 'bk-1', requestedBy: 'provider', status: 'pending' });
    const approvalId = requested.body.id;

    // 5. Still pending, so still no messages.
    await as(tokens.provider).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'hi' }).expect(403);

    // 6. Only an admin can approve it.
    await as(tokens.provider).patch(`/api/chat/approvals/${approvalId}`).send({ status: 'approved' }).expect(403);
    await as(tokens.admin).patch(`/api/chat/approvals/${approvalId}`).send({ status: 'maybe' }).expect(400);

    // 7. The admin sees it with names, not just ids, and no password hashes.
    const queue = await as(tokens.admin).get('/api/chat/approvals').expect(200);
    expect(queue.body[0]).toMatchObject({ id: approvalId, customerName: 'Rahim', providerName: 'Karim Services', serviceName: 'Home Cleaning' });
    expect(JSON.stringify(queue.body)).not.toContain('hash');

    const approved = await as(tokens.admin).patch(`/api/chat/approvals/${approvalId}`).send({ status: 'approved' }).expect(200);
    expect(approved.body.status).toBe('approved');

    // 8. Both sides can now talk. The role comes from the token: a client
    //    can't send senderRole/senderId to pretend to be the other side.
    await as(tokens.customer).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'hi', senderRole: 'provider' }).expect(400);
    await as(tokens.customer).post('/api/chat/messages').send({ bookingId: 'bk-1', message: '   ' }).expect(400);
    await as(tokens.customer).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'x'.repeat(2001) }).expect(400);

    const sent = await as(tokens.customer).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'Can you come at 10?' }).expect(201);
    expect(sent.body).toMatchObject({ senderType: 'customer', senderId: 'cust-1', message: 'Can you come at 10?' });
    await as(tokens.provider).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'Yes, see you then' }).expect(201);

    const convo = await as(tokens.provider).get('/api/chat/messages?bookingId=bk-1').expect(200);
    expect(convo.body.map((m: any) => [m.senderType, m.message])).toEqual([
      ['customer', 'Can you come at 10?'],
      ['provider', 'Yes, see you then'],
    ]);

    // 9. Outsiders can't read or write; the admin can read but not write.
    await as(tokens.otherCustomer).get('/api/chat/messages?bookingId=bk-1').expect(403);
    await as(tokens.otherProvider).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'hi' }).expect(403);
    await as(tokens.admin).get('/api/chat/messages?bookingId=bk-1').expect(200);
    await as(tokens.admin).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'hi' }).expect(403);

    // 10. The admin closes the chat: history stays, sending stops.
    await as(tokens.admin).patch(`/api/chat/approvals/${approvalId}`).send({ status: 'rejected' }).expect(200);
    await as(tokens.customer).post('/api/chat/messages').send({ bookingId: 'bk-1', message: 'still there?' }).expect(403);
    expect((await as(tokens.customer).get('/api/chat/messages?bookingId=bk-1').expect(200)).body).toHaveLength(2);
  });

  it('404s for a booking that does not exist', async () => {
    await as(tokens.customer).post('/api/chat/approvals').send({ bookingId: 'nope' }).expect(404);
  });
});
