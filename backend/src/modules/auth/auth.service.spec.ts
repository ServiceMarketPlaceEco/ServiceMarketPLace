// unit tests for AuthService
// we mock out the repos, jwt, config and mail so no real db or emails are needed
// run with: npm test

import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserTypeDto } from './dto';

// small helper so we dont have to retype the same mock repo everywhere
const mockRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => x),
  remove: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let customerRepo: any;
  let providerRepo: any;
  let adminRepo: any;
  let refreshRepo: any;
  let jwtService: any;
  let configService: any;
  let mailService: any;

  beforeEach(() => {
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    adminRepo = mockRepo();
    refreshRepo = mockRepo();

    jwtService = {
      sign: jest.fn(() => 'fake-jwt-token'),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string, fallback?: string) => fallback || 'test-secret'),
    };
    mailService = {
      sendWelcomeEmail: jest.fn(),
      sendProviderWelcomeEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    // building the service by hand instead of the full nest testing module, keeps it simple
    service = new AuthService(
      customerRepo,
      providerRepo,
      adminRepo,
      refreshRepo,
      jwtService,
      configService,
      mailService,
    );
  });

  describe('registerCustomer', () => {
    const dto: any = {
      name: 'Test Customer',
      email: 'test@example.com',
      password: 'Password@123',
      phone: '01700000000',
      address: 'Rajshahi',
    };

    it('registers a new customer and sends the welcome email', async () => {
      // no existing customer with this email
      customerRepo.findOne.mockResolvedValue(null);
      customerRepo.save.mockImplementation(async (c: any) => ({ ...c, customerId: 'cust-1' }));

      const result = await service.registerCustomer(dto);

      expect(customerRepo.save).toHaveBeenCalled();
      expect(mailService.sendWelcomeEmail).toHaveBeenCalledWith(dto.email, dto.name);
      expect(result.accessToken).toBe('fake-jwt-token');
      expect(result.userType).toBe('customer');
      // password hash should never be sent back to the frontend
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('throws ConflictException when the email is already used', async () => {
      customerRepo.findOne.mockResolvedValue({ customerId: 'existing' });

      await expect(service.registerCustomer(dto)).rejects.toThrow(ConflictException);
      // should bail out before saving anything
      expect(customerRepo.save).not.toHaveBeenCalled();
    });

    it('hashes the password before saving, doesnt store plain text', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      let savedCustomer: any;
      customerRepo.save.mockImplementation(async (c: any) => {
        savedCustomer = c;
        return { ...c, customerId: 'cust-1' };
      });

      await service.registerCustomer(dto);

      expect(savedCustomer.passwordHash).toBeDefined();
      expect(savedCustomer.passwordHash).not.toBe(dto.password);
      // the hash should actually match the original password
      const matches = await bcrypt.compare(dto.password, savedCustomer.passwordHash);
      expect(matches).toBe(true);
    });
  });

  describe('registerProvider', () => {
    const dto: any = {
      providerName: 'Test Provider',
      email: 'provider@example.com',
      password: 'Password@123',
      abn: '12345678901',
      address: 'Rajshahi',
      postalCode: '6000',
      phone: '01800000000',
      description: 'test provider',
    };

    it('registers a new provider', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      providerRepo.save.mockImplementation(async (p: any) => ({ ...p, providerId: 'prov-1' }));

      const result = await service.registerProvider(dto);

      expect(mailService.sendProviderWelcomeEmail).toHaveBeenCalled();
      expect(result.userType).toBe('provider');
    });

    it('throws ConflictException for a duplicate provider email', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'existing' });

      await expect(service.registerProvider(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('logs in a customer with correct password', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        email: 'test@example.com',
        passwordHash,
        isBlocked: false,
        isActive: true,
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password@123',
        userType: UserTypeDto.CUSTOMER,
      } as any);

      expect(result.accessToken).toBe('fake-jwt-token');
      expect(result.userType).toBe('customer');
    });

    it('rejects login when the user doesnt exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'x', userType: UserTypeDto.CUSTOMER } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login with the wrong password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword@1', 10);
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        email: 'test@example.com',
        passwordHash,
        isBlocked: false,
        isActive: true,
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPassword@1', userType: UserTypeDto.CUSTOMER } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('blocks a blocked customer from logging in', async () => {
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        email: 'test@example.com',
        passwordHash: 'whatever',
        isBlocked: true,
        isActive: true,
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'x', userType: UserTypeDto.CUSTOMER } as any),
      ).rejects.toThrow('Your account has been blocked');
    });

    it('blocks an inactive provider from logging in', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'prov-1',
        email: 'provider@example.com',
        passwordHash: 'whatever',
        isBlocked: false,
        isActive: false,
      });

      await expect(
        service.login({ email: 'provider@example.com', password: 'x', userType: UserTypeDto.PROVIDER } as any),
      ).rejects.toThrow('Your account is not active');
    });

    // ---- Admin login ----
    // This is the case the client asked about in their email, TC1 in the test
    // case report. Everything below is the service layer version of it.

    it('logs an admin in with the right password and returns userType admin', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@servicehub.local',
        passwordHash,
        isActive: true,
      });

      const result = await service.login({
        email: 'admin@servicehub.local',
        password: 'Password@123',
        userType: UserTypeDto.ADMIN,
      } as any);

      expect(result.accessToken).toBe('fake-jwt-token');
      // The frontend reads userType to decide which dashboard to show, so getting
      // this wrong would land an admin on the customer view.
      expect(result.userType).toBe('admin');
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('signs the admin token with the admin id, not a customer id', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@servicehub.local',
        passwordHash,
        isActive: true,
      });

      await service.login({
        email: 'admin@servicehub.local',
        password: 'Password@123',
        userType: UserTypeDto.ADMIN,
      } as any);

      // Whatever gets signed has to carry the admin id and the admin userType,
      // otherwise the guards on the admin endpoints won't let the request in.
      const [payload] = jwtService.sign.mock.calls[0];
      expect(payload.sub).toBe('admin-1');
      expect(payload.userType).toBe('admin');
    });

    it('rejects an admin login with the wrong password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword@1', 10);
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@servicehub.local',
        passwordHash,
        isActive: true,
      });

      await expect(
        service.login({
          email: 'admin@servicehub.local',
          password: 'WrongPassword@1',
          userType: UserTypeDto.ADMIN,
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an admin email that isnt registered', async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nobody@servicehub.local',
          password: 'Password@123',
          userType: UserTypeDto.ADMIN,
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('blocks a deactivated admin from logging in', async () => {
      adminRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@servicehub.local',
        passwordHash: 'whatever',
        isActive: false,
      });

      await expect(
        service.login({
          email: 'admin@servicehub.local',
          password: 'Password@123',
          userType: UserTypeDto.ADMIN,
        } as any),
      ).rejects.toThrow('Your account is not active');
    });

    it('a customer email cant get in through the admin option', async () => {
      // Picking Admin dashboard only looks in the admins table, so a real customer
      // email should still be turned away here.
      adminRepo.findOne.mockResolvedValue(null);
      customerRepo.findOne.mockResolvedValue({ customerId: 'cust-1' });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Password@123',
          userType: UserTypeDto.ADMIN,
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException for an unknown user type', async () => {
      await expect(
        service.login({ email: 'a@b.com', password: 'x', userType: 'alien' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('rejects an invalid or expired refresh token', async () => {
      refreshRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rotates the token, old one gets removed and new tokens come back', async () => {
      refreshRepo.findOne.mockResolvedValue({
        token: 'old-token',
        userId: 'cust-1',
        userType: 'customer',
        expiresAt: new Date(Date.now() + 100000),
      });
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const result = await service.refreshToken('old-token');

      // the used token should be deleted so it cant be replayed
      expect(refreshRepo.remove).toHaveBeenCalled();
      expect(result.accessToken).toBe('fake-jwt-token');
      expect(result.refreshToken).not.toBe('old-token');
    });
  });

  describe('logout', () => {
    it('deletes the refresh token', async () => {
      await service.logout('some-token');
      expect(refreshRepo.delete).toHaveBeenCalledWith({ token: 'some-token' });
    });
  });

  describe('forgotPassword', () => {
    it('quietly does nothing when the email doesnt exist (no user enumeration)', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await service.forgotPassword('ghost@example.com', UserTypeDto.CUSTOMER);

      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('sends the reset email for a real customer', async () => {
      customerRepo.findOne.mockResolvedValue({
        customerId: 'cust-1',
        email: 'test@example.com',
        name: 'Test Customer',
      });

      await service.forgotPassword('test@example.com', UserTypeDto.CUSTOMER);

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException for a bad or expired token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.resetPassword('expired-token', 'NewPassword@1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates the customer password when the token is valid', async () => {
      jwtService.verify.mockReturnValue({ sub: 'cust-1', userType: 'customer' });

      await service.resetPassword('good-token', 'NewPassword@1');

      expect(customerRepo.update).toHaveBeenCalled();
      // and it should update by the right customer id
      const [where] = customerRepo.update.mock.calls[0];
      expect(where).toEqual({ customerId: 'cust-1' });
    });
  });
});
