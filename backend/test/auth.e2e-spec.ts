

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { mockRepo, testConfigService, applyMainConfig, TEST_JWT_SECRET } from './test-helpers';

describe('Auth endpoints (integration)', () => {
  let app: INestApplication;
  let customerRepo: any;
  let providerRepo: any;
  let refreshRepo: any;
  let mailService: any;

  beforeAll(async () => {
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    refreshRepo = mockRepo();
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
        { provide: getRepositoryToken(Admin), useValue: mockRepo() },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
        { provide: MailService, useValue: mailService },
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
        .send({ email: 'test@example.com', password: 'Password@123', userType: 'customer' })
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
        .send({ email: 'test@example.com', password: 'WrongPassword@1', userType: 'customer' })
        .expect(401);
    });

    it('returns 401 for an email that doesnt exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'Password@123', userType: 'customer' })
        .expect(401);
    });

    it('returns 400 when userType isnt one of the allowed values', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password@123', userType: 'wizard' })
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
});
