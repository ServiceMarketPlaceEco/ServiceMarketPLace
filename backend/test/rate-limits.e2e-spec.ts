// Integration tests for the auth rate limits (must-fix 3 in the client's
// code review). Before this, login, password reset and the phone code routes
// had no limit, so a password or a 6 digit code could be guessed over and
// over. Now the limiter runs on every route (APP_GUARD, same as app.module.ts)
// and @AuthThrottle makes those routes stricter.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { PhoneVerification } from '../src/modules/auth/entities/phone-verification.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { mockRepo, testConfigService, applyMainConfig, TEST_JWT_SECRET } from './test-helpers';

const AUTH_LIMIT = 3;

// a fresh app each time, so the counts from one test don't leak into the next
async function buildApp() {
  const moduleRef = await Test.createTestingModule({
    // the global default is high, like the real app, so only the auth limit matters here
    imports: [JwtModule.register({ secret: TEST_JWT_SECRET }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }])],
    controllers: [AuthController],
    providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      AuthService,
      testConfigService,
      { provide: getRepositoryToken(Customer), useValue: mockRepo() },
      { provide: getRepositoryToken(ServiceProvider), useValue: mockRepo() },
      { provide: getRepositoryToken(Admin), useValue: mockRepo() },
      { provide: getRepositoryToken(RefreshToken), useValue: mockRepo() },
      { provide: getRepositoryToken(PhoneVerification), useValue: mockRepo() },
      { provide: MailService, useValue: { sendPasswordResetEmail: jest.fn() } },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  applyMainConfig(app);
  await app.init();
  return app;
}

describe('Auth rate limits (integration)', () => {
  let app: INestApplication;

  beforeAll(() => {
    process.env.AUTH_RATE_LIMIT = String(AUTH_LIMIT);
  });

  afterAll(() => {
    delete process.env.AUTH_RATE_LIMIT;
  });

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it(`blocks login with 429 after ${AUTH_LIMIT} wrong passwords in a minute`, async () => {
    const server = app.getHttpServer();
    const wrongPassword = { identifier: 'someone@example.com', password: 'wrong-password' };

    for (let i = 0; i < AUTH_LIMIT; i++) {
      // nobody has this email, so each try is a normal 401
      await request(server).post('/api/auth/login').send(wrongPassword).expect(401);
    }
    await request(server).post('/api/auth/login').send(wrongPassword).expect(429);
  });

  it('limits guessing phone verification codes', async () => {
    const server = app.getHttpServer();
    const guess = { verificationId: '00000000-0000-0000-0000-000000000000', phone: '01700000000', code: '000000' };

    for (let i = 0; i < AUTH_LIMIT; i++) {
      await request(server).post('/api/auth/phone-verification/verify').send(guess).expect(400);
    }
    await request(server).post('/api/auth/phone-verification/verify').send(guess).expect(429);
  });

  it('limits password reset requests', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < AUTH_LIMIT; i++) {
      await request(server).post('/api/auth/forgot-password').send({ email: 'someone@example.com', userType: 'customer' }).expect(200);
    }
    await request(server).post('/api/auth/forgot-password').send({ email: 'someone@example.com', userType: 'customer' }).expect(429);
  });

  it('keeps a separate count for each route, so a locked login does not block password reset', async () => {
    const server = app.getHttpServer();
    const wrongPassword = { identifier: 'someone@example.com', password: 'wrong-password' };
    for (let i = 0; i <= AUTH_LIMIT; i++) {
      await request(server).post('/api/auth/login').send(wrongPassword);
    }
    await request(server).post('/api/auth/forgot-password').send({ email: 'someone@example.com', userType: 'customer' }).expect(200);
  });
});
