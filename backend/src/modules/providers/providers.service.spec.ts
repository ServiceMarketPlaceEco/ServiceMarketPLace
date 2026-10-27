// Unit tests for ProvidersService.
// Covers the public provider list and profile, the provider's own profile and
// password, managing the services they offer, and the admin verify/block actions.
// Both repos are mocked so no database is needed.
// Run with: npm test

import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Like, MoreThanOrEqual } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ProvidersService } from './providers.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((x: any) => x),
  save: jest.fn(async (x: any) => x),
  remove: jest.fn(),
  update: jest.fn(),
});

describe('ProvidersService', () => {
  let service: ProvidersService;
  let providerRepo: any;
  let providerServiceRepo: any;

  beforeEach(() => {
    providerRepo = mockRepo();
    providerServiceRepo = mockRepo();
    service = new ProvidersService(providerRepo, providerServiceRepo);
  });

  describe('findAll (public provider list)', () => {
    it('only lists active, unblocked, admin approved providers, best rated first', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({} as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.where).toEqual({ isActive: true, isBlocked: false, isVerified: true });
      expect(options.order).toEqual({ rating: 'DESC' });
    });

    it('never returns private fields like the email or password hash', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({} as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.select).not.toContain('email');
      expect(options.select).not.toContain('passwordHash');
    });

    it('applies the minimum rating and name search filters', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({ minRating: 4, search: 'clean' } as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.where.rating).toEqual(MoreThanOrEqual(4));
      expect(options.where.providerName).toEqual(Like('%clean%'));
    });

    // M7 in the qa report - ?verified=false used to list unapproved providers
    it('never lists unapproved providers, even when asked with verified=false', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({ verified: false } as any);

      expect(providerRepo.find.mock.calls[0][0].where.isVerified).toBe(true);
    });

    it('only keeps providers who currently offer the requested service', async () => {
      providerRepo.find.mockResolvedValue([
        { providerId: 'p-1', providerName: 'Offers it' },
        { providerId: 'p-2', providerName: 'Does not' },
      ]);
      providerServiceRepo.find.mockResolvedValue([{ providerId: 'p-1' }]);

      const result = await service.findAll({ serviceId: 's-1' } as any);

      expect(providerServiceRepo.find.mock.calls[0][0].where).toEqual({ serviceId: 's-1', isAvailable: true });
      expect(result.map((p) => p.providerId)).toEqual(['p-1']);
    });
  });

  describe('findById', () => {
    it('returns the provider with their services', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1' });

      const result = await service.findById('p-1');

      expect(result.providerId).toBe('p-1');
      expect(providerRepo.findOne.mock.calls[0][0].relations).toContain('providerServices');
    });

    it('throws NotFoundException for a provider that doesnt exist', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPublicProfile', () => {
    it('shows only available services and flattens them for the profile page', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'p-1',
        providerName: 'Rajshahi Cleaners',
        providerServices: [
          { id: 'ps-1', serviceId: 's-1', isAvailable: true, price: 500, description: 'Deep clean', service: { serviceName: 'Home Cleaning' } },
          { id: 'ps-2', serviceId: 's-2', isAvailable: false, price: 900, description: 'Paused', service: { serviceName: 'AC Repair' } },
        ],
      });

      const result = await service.getPublicProfile('p-1');

      expect(result.services).toEqual([
        { id: 'ps-1', serviceId: 's-1', serviceName: 'Home Cleaning', price: 500, description: 'Deep clean' },
      ]);
      // The raw relation is replaced by the cleaned-up services list.
      expect(result.providerServices).toBeUndefined();
      expect(result.providerName).toBe('Rajshahi Cleaners');
    });

    it('hides blocked, inactive or unapproved providers from the public', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.getPublicProfile('p-1')).rejects.toThrow(NotFoundException);
      expect(providerRepo.findOne.mock.calls[0][0].where).toEqual({
        providerId: 'p-1',
        isActive: true,
        isBlocked: false,
        isVerified: true,
      });
    });
  });

  describe('own profile', () => {
    it('getProfile returns the signed in provider', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1' });
      expect((await service.getProfile('p-1')).providerId).toBe('p-1');
    });

    it('updateProfile saves the changed fields', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', description: 'old' });

      const result = await service.updateProfile('p-1', { description: 'new' } as any);

      expect(result.description).toBe('new');
      expect(providerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ description: 'new' }));
    });
  });

  describe('changePassword', () => {
    it('hashes and saves the new password when the current one is right', async () => {
      const passwordHash = await bcrypt.hash('OldPass@1', 10);
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', passwordHash });

      await service.changePassword('p-1', { currentPassword: 'OldPass@1', newPassword: 'NewPass@2' } as any);

      const saved = providerRepo.save.mock.calls[0][0];
      expect(saved.passwordHash).not.toBe(passwordHash);
      expect(await bcrypt.compare('NewPass@2', saved.passwordHash)).toBe(true);
    });

    it('rejects a wrong current password and saves nothing', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', passwordHash: await bcrypt.hash('OldPass@1', 10) });

      await expect(
        service.changePassword('p-1', { currentPassword: 'wrong', newPassword: 'NewPass@2' } as any),
      ).rejects.toThrow(UnauthorizedException);
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the provider is missing', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.changePassword('ghost', { currentPassword: 'a', newPassword: 'b' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('managing offered services', () => {
    it('adds a new service with the providers price', async () => {
      providerServiceRepo.findOne.mockResolvedValue(null);

      const result = await service.addService('p-1', { serviceId: 's-1', price: 500, description: 'Deep clean' } as any);

      expect(result).toEqual({ providerId: 'p-1', serviceId: 's-1', price: 500, description: 'Deep clean' });
      expect(providerServiceRepo.save).toHaveBeenCalled();
    });

    it('refuses to add the same service twice', async () => {
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-1' });

      await expect(service.addService('p-1', { serviceId: 's-1', price: 500 } as any)).rejects.toThrow(ConflictException);
      expect(providerServiceRepo.save).not.toHaveBeenCalled();
    });

    it('updates an offering that belongs to this provider', async () => {
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-1', providerId: 'p-1', price: 500 });

      const result = await service.updateService('p-1', 'ps-1', { price: 650 } as any);

      expect(result.price).toBe(650);
      // The lookup is scoped to the provider so one provider cannot edit anothers offering.
      expect(providerServiceRepo.findOne.mock.calls[0][0].where).toEqual({ id: 'ps-1', providerId: 'p-1' });
    });

    it('throws NotFoundException when updating an offering they dont own', async () => {
      providerServiceRepo.findOne.mockResolvedValue(null);
      await expect(service.updateService('p-1', 'ps-9', { price: 1 } as any)).rejects.toThrow(NotFoundException);
    });

    it('removes an offering that belongs to this provider', async () => {
      const offering = { id: 'ps-1', providerId: 'p-1' };
      providerServiceRepo.findOne.mockResolvedValue(offering);

      await service.removeService('p-1', 'ps-1');

      expect(providerServiceRepo.remove).toHaveBeenCalledWith(offering);
    });

    it('throws NotFoundException when removing an offering they dont own', async () => {
      providerServiceRepo.findOne.mockResolvedValue(null);
      await expect(service.removeService('p-1', 'ps-9')).rejects.toThrow(NotFoundException);
      expect(providerServiceRepo.remove).not.toHaveBeenCalled();
    });

    it('lists the providers offerings with the service details', async () => {
      providerServiceRepo.find.mockResolvedValue([{ id: 'ps-1' }]);

      const result = await service.getServices('p-1');

      expect(result).toHaveLength(1);
      expect(providerServiceRepo.find).toHaveBeenCalledWith({ where: { providerId: 'p-1' }, relations: ['service'] });
    });
  });

  describe('admin actions', () => {
    it('findAllAdmin lists every provider newest first without the password hash', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAllAdmin();

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.order).toEqual({ createdAt: 'DESC' });
      expect(options.select).toContain('isBlocked');
      expect(options.select).not.toContain('passwordHash');
    });

    it.each([true, false])('verifyProvider sets isVerified to %s', async (verify) => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', isVerified: !verify });

      const result = await service.verifyProvider('p-1', verify);

      expect(result.isVerified).toBe(verify);
      expect(providerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'p-1', isVerified: verify }));
    });

    it.each([true, false])('blockProvider sets isBlocked to %s', async (block) => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', isBlocked: !block });

      const result = await service.blockProvider('p-1', block);

      expect(result.isBlocked).toBe(block);
      expect(providerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'p-1', isBlocked: block }));
    });

    it('verifyProvider throws NotFoundException for an unknown provider', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyProvider('ghost', true)).rejects.toThrow(NotFoundException);
    });
  });

  it('updateRating stores the new average and review count', async () => {
    await service.updateRating('p-1', 4.5, 12);
    expect(providerRepo.update).toHaveBeenCalledWith('p-1', { rating: 4.5, totalReviews: 12 });
  });
});
