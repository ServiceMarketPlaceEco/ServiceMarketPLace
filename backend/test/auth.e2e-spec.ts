

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { PhoneVerification } from '../src/modules/auth/entities/phone-verification.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { SmsService } from '../src/modules/sms/sms.service';
import { mockRepo, testConfigService, applyMainConfig, TEST_JWT_SECRET } from './test-helpers';

describe('Auth endpoints (integration)', () => {
  let app: INestApplication;
  let customerRepo: any;
  let providerRepo: any;
  let adminRepo: any;
  let refreshRepo: any;
  let phoneVerificationRepo: any;
  let mailService: any;

  beforeAll(async () => {
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    adminRepo = mockRepo();
    refreshRepo = mockRepo();
    phoneVerificationRepo = mockRepo();
    mailService = {
      sendWelcomeEmail: jest.fn(),
      sendProviderWelcomeEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
      controllers: [AuthController],
      providers: [
        AuthService,
        testConfigService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
        { provide: getRepositoryToken(PhoneVerification), useValue: phoneVerificationRepo },
        { provide: MailService, useValue: mailService },
        { provide: SmsService, useValue: { isConfigured: () => false, send: jest.fn() } },
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

  describe('POST /api/auth/register/customer', () => {
    const validBody = {
      name: 'Test Customer',
      username: 'testcustomer',
      email: 'test@example.com',
      password: 'Password@123',
      phone: '01700000000',
      address: 'Rajshahi',
    };

    it('registers a customer and returns 201 with tokens', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      customerRepo.save.mockImplementation(async (c: any) => ({ ...c, customerId: 'cust-1' }));

      const res = await request(app.getHttpServer())
        .post('/api/auth/register/customer')
        .send(validBody)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.userType).toBe('customer');
      // password hash should never come back over the api
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 400 for a bad email, the validation pipe catches it', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register/customer')
        .send({ ...validBody, email: 'not-an-email' })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('email');
    });

    it('returns 400 for a weak password that fails the policy', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register/customer')
        .send({ ...validBody, password: 'weakpass' })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('Password');
    });

    it('returns 400 when the body has fields that arent in the dto', async () => {
      // forbidNonWhitelisted is on in main.ts so junk fields get rejected
      await request(app.getHttpServer())
        .post('/api/auth/register/customer')
        .send({ ...validBody, hackerField: 'nope' })
        .expect(400);
    });

    it('returns 409 when the email is already registered', async () => {
      customerRepo.findOne.mockResolvedValue({ customerId: 'existing' });

      await request(app.getHttpServer())
        .post('/api/auth/register/customer')
        .send(validBody)
        .expect(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct details and returns 200', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        email: 'test@example.com',
        passwordHash,
        isBlocked: false,
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'test@example.com', password: 'Password@123', userType: 'customer' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });

    it('returns 401 for the wrong password', async () => {
      const passwordHash = await bcrypt.hash('RealPassword@1', 10);
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        email: 'test@example.com',
        passwordHash,
        isBlocked: false,
        isActive: true,
      });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'test@example.com', password: 'WrongPassword@1', userType: 'customer' })
        .expect(401);
    });

    it('returns 401 for an email that doesnt exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'ghost@example.com', password: 'Password@123', userType: 'customer' })
        .expect(401);
    });

    // ---- Admin login over HTTP ----
    // Same case as TC1 in the test case report, but going through the real
    // controller and validation pipe this time rather than calling the service.

    it('logs an admin in and returns userType admin so the app can route to /admin', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@servicehub.local',
        passwordHash,
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          identifier: 'admin@servicehub.local',
          password: 'Password@123',
          userType: 'admin',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      // The frontend reads userType to decide where to send them.
      expect(res.body.userType).toBe('admin');
    });

    it('never sends the admin password hash back in the login response', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@servicehub.local',
        passwordHash,
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          identifier: 'admin@servicehub.local',
          password: 'Password@123',
          userType: 'admin',
        })
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain(passwordHash);
    });

    it('returns 401 for an admin login with the wrong password', async () => {
      const passwordHash = await bcrypt.hash('RealPassword@1', 10);
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@servicehub.local',
        passwordHash,
        isActive: true,
      });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          identifier: 'admin@servicehub.local',
          password: 'WrongPassword@1',
          userType: 'admin',
        })
        .expect(401);
    });

    it('returns 401 for an admin email that isnt registered', async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          identifier: 'nobody@servicehub.local',
          password: 'Password@123',
          userType: 'admin',
        })
        .expect(401);
    });

    it('returns 401 for a deactivated admin account', async () => {
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@servicehub.local',
        passwordHash: 'whatever',
        isActive: false,
      });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          identifier: 'admin@servicehub.local',
          password: 'Password@123',
          userType: 'admin',
        })
        .expect(401);
    });

    it('returns 400 when userType isnt one of the allowed values', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'test@example.com', password: 'Password@123', userType: 'wizard' })
        .expect(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns 401 for an unknown or expired refresh token', async () => {
      refreshRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'made-up-token' })
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 200 and the logged out message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken: 'whatever-token' })
        .expect(200);

      expect(res.body.message).toBe('Logged out successfully');
      expect(refreshRepo.delete).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('always returns 200 so nobody can probe which emails exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'ghost@example.com', userType: 'customer' })
        .expect(200);

      expect(res.body.message).toContain('If an account exists');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const provider = { providerId: 'prov-9', providerName: 'Karim', email: 'karim@example.com', passwordHash: 'old-hash' };

    // asks for a reset with no account type, like the app does, and returns
    // the token the email would carry
    async function requestReset() {
      customerRepo.findOne.mockResolvedValue(null);
      providerRepo.findOne.mockResolvedValue({ ...provider });
      await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: provider.email })
        .expect(200);
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      return mailService.sendPasswordResetEmail.mock.calls[0][2];
    }

    it('a provider gets a reset email without saying what kind of account it is', async () => {
      const token = await requestReset();
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith('karim@example.com', 'Karim', token);
    });

    it('the reset token works once and stops working after the password changes', async () => {
      const token = await requestReset();

      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'NewPassword@2026' })
        .expect(200);
      expect(providerRepo.update).toHaveBeenCalledWith({ providerId: 'prov-9' }, expect.objectContaining({ passwordHash: expect.any(String) }));

      // the stored hash is now different, so the same link is refused
      providerRepo.findOne.mockResolvedValue({ ...provider, passwordHash: 'new-hash' });
      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'Another@2026' })
        .expect(400);
    });

    it('refuses a normal sign-in token as a reset token', async () => {
      const signedIn = new JwtService({ secret: TEST_JWT_SECRET }).sign({ sub: 'prov-9', email: provider.email, userType: 'provider' });
      providerRepo.findOne.mockResolvedValue({ ...provider });

      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: signedIn, newPassword: 'Hacked@12345' })
        .expect(400);
      expect(providerRepo.update).not.toHaveBeenCalled();
    });
  });
});
