// Integration tests for the admin support chat routes: login, who may use
// which side, and input checks. The rules themselves are covered in
// support.service.spec.ts, so SupportService is a fake here and the real JWT
// login and guards are used.

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { SupportController } from '../src/modules/support/support.controller';
import { SupportService } from '../src/modules/support/support.service';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

const USER_ID = 'a0000001-0000-0000-0000-000000000001'; // a seeded-style id

describe('Support chat endpoints (integration)', () => {
  let app: INestApplication;
  let support: any;

  const customerToken = () => signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });
  const providerToken = () => signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });
  const adminToken = () => signTestToken({ sub: 'admin-1', email: 'a@x.com', userType: 'admin' });

  beforeAll(async () => {
    support = {
      getMyMessages: jest.fn(async () => []),
      sendAsUser: jest.fn(async (_u: any, message: string) => ({ id: 'm-1', message })),
      unreadForUser: jest.fn(async () => 2),
      unreadForAdmins: jest.fn(async () => 5),
      listThreads: jest.fn(async () => []),
      getMessagesAsAdmin: jest.fn(async () => []),
      sendAsAdmin: jest.fn(async (_a: any, _t: string, _i: string, message: string) => ({ id: 'm-2', message })),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [SupportController],
      providers: [
        JwtStrategy,
        testConfigService,
        { provide: SupportService, useValue: support },
        {
          provide: getRepositoryToken(Customer),
          useValue: { ...mockRepo(), findOne: jest.fn(async () => ({ customerId: 'cust-1', isActive: true, isBlocked: false })) },
        },
        {
          provide: getRepositoryToken(ServiceProvider),
          useValue: {
            ...mockRepo(),
            findOne: jest.fn(async () => ({ providerId: 'prov-1', isActive: true, isBlocked: false, isVerified: true })),
          },
        },
        {
          provide: getRepositoryToken(Admin),
          useValue: { ...mockRepo(), findOne: jest.fn(async () => ({ id: 'admin-1', isActive: true, role: 'admin' })) },
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

  beforeEach(() => jest.clearAllMocks());

  it('needs a login for every route', async () => {
    await request(app.getHttpServer()).get('/api/support/messages').expect(401);
    await request(app.getHttpServer()).post('/api/support/messages').send({ message: 'hi' }).expect(401);
    await request(app.getHttpServer()).get('/api/support/threads').expect(401);
    await request(app.getHttpServer()).get('/api/support/unread').expect(401);
    expect(support.sendAsUser).not.toHaveBeenCalled();
  });

  it('lets a customer and a provider write to the admin team as themselves', async () => {
    for (const token of [customerToken(), providerToken()]) {
      await request(app.getHttpServer())
        .post('/api/support/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: '  Can you help?  ' })
        .expect(201);
    }

    expect(support.sendAsUser.mock.calls.map((call: any[]) => [call[0].userType, call[1]])).toEqual([
      ['customer', 'Can you help?'],
      ['provider', 'Can you help?'],
    ]);
  });

  it('refuses an empty or very long message', async () => {
    for (const message of ['', '   ', 'x'.repeat(2001)]) {
      await request(app.getHttpServer())
        .post('/api/support/messages')
        .set('Authorization', `Bearer ${customerToken()}`)
        .send({ message })
        .expect(400);
    }
    expect(support.sendAsUser).not.toHaveBeenCalled();
  });

  it('keeps the inbox for admins only', async () => {
    for (const token of [customerToken(), providerToken()]) {
      await request(app.getHttpServer()).get('/api/support/threads').set('Authorization', `Bearer ${token}`).expect(403);
      await request(app.getHttpServer())
        .get(`/api/support/threads/customer/${USER_ID}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/support/threads/customer/${USER_ID}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'hi' })
        .expect(403);
    }
    expect(support.listThreads).not.toHaveBeenCalled();
    expect(support.sendAsAdmin).not.toHaveBeenCalled();

    await request(app.getHttpServer()).get('/api/support/threads').set('Authorization', `Bearer ${adminToken()}`).expect(200);
  });

  it('lets an admin read and reply to one conversation', async () => {
    await request(app.getHttpServer())
      .get(`/api/support/threads/provider/${USER_ID}/messages`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200);
    expect(support.getMessagesAsAdmin).toHaveBeenCalledWith('provider', USER_ID);

    await request(app.getHttpServer())
      .post(`/api/support/threads/provider/${USER_ID}/messages`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ message: 'Your documents are approved.' })
      .expect(201);
    expect(support.sendAsAdmin.mock.calls[0].slice(1)).toEqual(['provider', USER_ID, 'Your documents are approved.']);
  });

  it('refuses a user type or id that is not valid', async () => {
    await request(app.getHttpServer())
      .get(`/api/support/threads/admin/${USER_ID}/messages`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/support/threads/customer/not-an-id/messages')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(400);
  });

  it('gives each role its own unread count', async () => {
    const forCustomer = await request(app.getHttpServer())
      .get('/api/support/unread')
      .set('Authorization', `Bearer ${customerToken()}`)
      .expect(200);
    const forAdmin = await request(app.getHttpServer())
      .get('/api/support/unread')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200);

    expect(forCustomer.body).toEqual({ unread: 2 });
    expect(forAdmin.body).toEqual({ unread: 5 });
  });
});
