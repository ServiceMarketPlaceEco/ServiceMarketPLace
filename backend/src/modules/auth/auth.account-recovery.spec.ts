// Extra unit tests for AuthService: staying signed in (refresh tokens), password
// reset for every account type, and the sign-in checks for providers and admins.
// The main auth.service.spec.ts covers customers; these fill in the provider and
// admin paths that were not tested before.
// Run with: npm test

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserTypeDto } from './dto';

const mockRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => x),
  remove: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
});

describe('AuthService account recovery and role sign-in', () => {
  let service: AuthService;
  let customerRepo: any;
  let providerRepo: any;
  let adminRepo: any;
  let refreshRepo: any;
  let phoneVerificationRepo: any;
  let jwtService: any;
  let mailService: any;

  beforeEach(() => {
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    adminRepo = mockRepo();
    refreshRepo = mockRepo();
    phoneVerificationRepo = mockRepo();
    jwtService = { sign: jest.fn(() => 'signed-token'), verify: jest.fn() };
    mailService = { sendPasswordResetEmail: jest.fn() };
    const configService = { get: jest.fn((key: string, fallback?: string) => fallback || 'test-secret') };

    service = new AuthService(
      customerRepo,
      providerRepo,
      adminRepo,
      refreshRepo,
      phoneVerificationRepo,
      jwtService,
      configService as any,
      mailService,
    );
  });

  describe('refreshToken for each account type', () => {
    const stored = (userType: string, userId: string) => ({
      token: 'old',
      userId,
      userType,
      expiresAt: new Date(Date.now() + 60_000),
    });

    it('issues new tokens for a provider', async () => {
      refreshRepo.findOne.mockResolvedValue(stored('provider', 'prov-1'));
      providerRepo.findOne.mockResolvedValue({ providerId: 'prov-1', email: 'p@x.com', providerName: 'P' });

      const result = await service.refreshToken('old');

      expect(providerRepo.findOne).toHaveBeenCalledWith({ where: { providerId: 'prov-1' } });
      expect(result.userType).toBe('provider');
      expect(result.accessToken).toBe('signed-token');
    });

    it('issues new tokens for an admin', async () => {
      refreshRepo.findOne.mockResolvedValue(stored('admin', 'admin-1'));
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', email: 'a@x.com', name: 'A' });

      const result = await service.refreshToken('old');

      expect(adminRepo.findOne).toHaveBeenCalledWith({ where: { id: 'admin-1' } });
      expect(result.userType).toBe('admin');
    });

    it('rejects the refresh when the account has since been deleted', async () => {
      refreshRepo.findOne.mockResolvedValue(stored('customer', 'cust-gone'));
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshToken('old')).rejects.toThrow(new UnauthorizedException('User not found'));
      // the used refresh token is still removed so it cannot be tried again
      expect(refreshRepo.remove).toHaveBeenCalled();
    });
  });

  describe('forgotPassword for each account type', () => {
    it('emails a provider a 1 hour reset link addressed by their business name', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'prov-1', providerName: 'Rajshahi Cleaners' });

      await service.forgotPassword('p@x.com', UserTypeDto.PROVIDER);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'prov-1', email: 'p@x.com', userType: UserTypeDto.PROVIDER },
        expect.objectContaining({ expiresIn: '1h' }),
      );
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith('p@x.com', 'Rajshahi Cleaners', 'signed-token');
    });

    it('emails an admin a reset link', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', name: 'Site Admin' });

      await service.forgotPassword('a@x.com', UserTypeDto.ADMIN);

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith('a@x.com', 'Site Admin', 'signed-token');
    });

    it('only looks in the table for the account type it was given', async () => {
      // This is why the frontend sending "customer" for everyone means providers
      // and admins never get a reset email (see the QA report).
      customerRepo.findOne.mockResolvedValue(null);
      providerRepo.findOne.mockResolvedValue({ providerId: 'prov-1', providerName: 'P' });

      await service.forgotPassword('p@x.com', UserTypeDto.CUSTOMER);

      expect(providerRepo.findOne).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword for each account type', () => {
    it.each([
      ['provider', () => providerRepo, { providerId: 'prov-1' }, 'prov-1'],
      ['admin', () => adminRepo, { id: 'admin-1' }, 'admin-1'],
    ])('saves a hashed new password for a %s', async (userType, repo, where, sub) => {
      jwtService.verify.mockReturnValue({ sub, userType });

      await service.resetPassword('good-token', 'NewPass@2');

      const [whereArg, change] = repo().update.mock.calls[0];
      expect(whereArg).toEqual(where);
      expect(await bcrypt.compare('NewPass@2', change.passwordHash)).toBe(true);
    });

    it('rejects a token with an unknown account type', async () => {
      jwtService.verify.mockReturnValue({ sub: 'x', userType: 'hacker' });

      await expect(service.resetPassword('token', 'NewPass@2')).rejects.toThrow(BadRequestException);
      expect(customerRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('sign-in checks for providers and admins', () => {
    const hash = () => bcrypt.hash('Password@123', 10);

    it('refuses a blocked provider', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p', email: 'p@x.com', passwordHash: await hash(), isBlocked: true, isActive: true });

      await expect(
        service.login({ identifier: 'p@x.com', password: 'Password@123', userType: UserTypeDto.PROVIDER } as any),
      ).rejects.toThrow('Your account has been blocked');
    });

    it('refuses an inactive provider', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p', email: 'p@x.com', passwordHash: await hash(), isBlocked: false, isActive: false });

      await expect(
        service.login({ identifier: 'p@x.com', password: 'Password@123', userType: UserTypeDto.PROVIDER } as any),
      ).rejects.toThrow('Your account is not active');
    });

    it('refuses an inactive admin', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'a', email: 'a@x.com', passwordHash: await hash(), isActive: false });

      await expect(
        service.login({ identifier: 'a@x.com', password: 'Password@123', userType: UserTypeDto.ADMIN } as any),
      ).rejects.toThrow('Your account is not active');
    });

    it('works out that an email belongs to a customer first when no type is sent', async () => {
      customerRepo.findOne
        .mockResolvedValueOnce({ customerId: 'c-1' }) // role lookup
        .mockResolvedValueOnce({ customerId: 'c-1', email: 'c@x.com', name: 'C', passwordHash: await hash(), isActive: true, isBlocked: false });

      const result = await service.login({ identifier: 'c@x.com', password: 'Password@123' } as any);

      expect(result.userType).toBe('customer');
      // a customer match means the provider and admin tables are never checked
      expect(providerRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
