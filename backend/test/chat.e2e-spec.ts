// Integration tests for the chat routes: login, who may do what, and input
// checks. The chat rules themselves are covered in chat.service.spec.ts, so
// here ChatService is a fake and the real JWT login and guards are used.

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { ChatController } from '../src/modules/chat/chat.controller';
import { ChatService } from '../src/modules/chat/chat.service';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

const CHAT_ID = '3c9e1d2a-5b6f-4a7c-8d9e-0f1a2b3c4d5e';
const USER_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';

describe('Chat endpoints (integration)', () => {
  let app: INestApplication;
  let chat: any;
  let customerRepo: any;
  let providerRepo: any;
  let adminRepo: any;

  const customerToken = () => signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });
  const providerToken = () => signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });
  const adminToken = () => signTestToken({ sub: 'admin-1', email: 'a@x.com', userType: 'admin' });

  beforeAll(async () => {
    chat = {
      listConversations: jest.fn(async () => []),
      getMessages: jest.fn(async () => []),
      sendMessage: jest.fn(async (_u: any, id: string, body: string) => ({ messageId: 'm-1', conversationId: id, body })),
      startSupportChat: jest.fn(async () => ({ conversationId: CHAT_ID })),
    };
    customerRepo = { ...mockRepo(), findOne: jest.fn(async () => ({ customerId: 'cust-1', isActive: true, isBlocked: false, name: 'Nusrat' })) };
    providerRepo = {
      ...mockRepo(),
      findOne: jest.fn(async () => ({ providerId: 'prov-1', isActive: true, isBlocked: false, isVerified: true })),
    };
    adminRepo = { ...mockRepo(), findOne: jest.fn(async () => ({ id: 'admin-1', isActive: true, role: 'admin' })) };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ChatController],
      providers: [
        JwtStrategy,
        testConfigService,
        { provide: ChatService, useValue: chat },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
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

  beforeEach(() => jest.clearAllMocks());

  it('needs a login for every chat route', async () => {
    await request(app.getHttpServer()).get('/api/chat/conversations').expect(401);
    await request(app.getHttpServer()).get(`/api/chat/conversations/${CHAT_ID}/messages`).expect(401);
    await request(app.getHttpServer()).post(`/api/chat/conversations/${CHAT_ID}/messages`).send({ body: 'hi' }).expect(401);
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('lists chats for customers, providers and admins', async () => {
    for (const token of [customerToken(), providerToken(), adminToken()]) {
      await request(app.getHttpServer()).get('/api/chat/conversations').set('Authorization', `Bearer ${token}`).expect(200);
    }
    expect(chat.listConversations.mock.calls.map((call: any[]) => call[0].userType)).toEqual([
      'customer',
      'provider',
      'admin',
    ]);
  });

  it('sends a message as the signed in user', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/chat/conversations/${CHAT_ID}/messages`)
      .set('Authorization', `Bearer ${providerToken()}`)
      .send({ body: '  On my way  ' })
      .expect(201);

    expect(res.body.body).toBe('On my way');
    const [user, id] = chat.sendMessage.mock.calls[0];
    expect(user.userId).toBe('prov-1');
    expect(id).toBe(CHAT_ID);
  });

  it('refuses an empty or very long message', async () => {
    for (const body of ['', '   ', 'x'.repeat(2001)]) {
      await request(app.getHttpServer())
        .post(`/api/chat/conversations/${CHAT_ID}/messages`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .send({ body })
        .expect(400);
    }
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('refuses a chat id that is not a real id', async () => {
    await request(app.getHttpServer())
      .get('/api/chat/conversations/not-an-id/messages')
      .set('Authorization', `Bearer ${customerToken()}`)
      .expect(400);
  });

  it('passes the refresh time through and refuses a bad one', async () => {
    await request(app.getHttpServer())
      .get(`/api/chat/conversations/${CHAT_ID}/messages?after=2026-11-06T02:00:00.000Z`)
      .set('Authorization', `Bearer ${customerToken()}`)
      .expect(200);
    expect(chat.getMessages.mock.calls[0][2]).toBe('2026-11-06T02:00:00.000Z');

    await request(app.getHttpServer())
      .get(`/api/chat/conversations/${CHAT_ID}/messages?after=yesterday`)
      .set('Authorization', `Bearer ${customerToken()}`)
      .expect(400);
  });

  it('lets only admins start a chat with a user', async () => {
    await request(app.getHttpServer())
      .post('/api/chat/conversations/support')
      .set('Authorization', `Bearer ${customerToken()}`)
      .send({ userType: 'provider', userId: USER_ID })
      .expect(403);
    expect(chat.startSupportChat).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post('/api/chat/conversations/support')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ userType: 'provider', userId: USER_ID })
      .expect(201);
    expect(chat.startSupportChat.mock.calls[0].slice(1)).toEqual(['provider', USER_ID]);
  });

  it('checks the admin picked a customer or provider', async () => {
    await request(app.getHttpServer())
      .post('/api/chat/conversations/support')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ userType: 'admin', userId: USER_ID })
      .expect(400);
  });
});
