// Unit tests for ProvidersService.
// This is the whole provider side: the public directory customers browse, the
// provider's own profile, the services they list and price up, and the verify
// and block actions the admin has.
// Repos are mocked so no MySQL needed.
// Run with: npm test

import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
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

  describe('findAll', () => {
    it('only lists active, unblocked providers in the public directory', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({} as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.where.isActive).toBe(true);
      expect(options.where.isBlocked).toBe(false);
    });

    it('sorts the directory by rating, best first', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({} as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.order).toEqual({ rating: 'DESC' });
    });

    it('filters to verified providers when asked', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({ verified: true } as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.where.isVerified).toBe(true);
    });

    it('applies a minimum rating filter', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({ minRating: 4 } as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.where.rating).toBeDefined();
    });

    it('applies a name search filter', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({ search: 'Rajshahi' } as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.where.providerName).toBeDefined();
    });

    it('narrows the list to providers who actually offer that service', async () => {
      providerRepo.find.mockResolvedValue([
        { providerId: 'p-1', providerName: 'Offers It' },
        { providerId: 'p-2', providerName: 'Does Not Offer It' },
      ]);
      providerServiceRepo.find.mockResolvedValue([{ providerId: 'p-1' }]);

      const result = await service.findAll({ serviceId: 's-1' } as any);

      expect(result).toHaveLength(1);
      expect(result[0].providerName).toBe('Offers It');
    });

    it('never selects the provider password hash for the public list', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAll({} as any);

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.select).not.toContain('passwordHash');
    });
  });

  describe('findById', () => {
    it('returns the provider when they exist', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1' });

      const result = await service.findById('p-1');
      expect(result.providerId).toBe('p-1');
    });

    it('throws NotFoundException for a provider that doesnt exist', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPublicProfile', () => {
    it('hides the services the provider has switched off', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'p-1',
        providerName: 'Rajshahi Cleaners',
        providerServices: [
          {
            id: 'ps-1',
            serviceId: 's-1',
            price: 500,
            isAvailable: true,
            service: { serviceName: 'Home Cleaning' },
          },
          {
            id: 'ps-2',
            serviceId: 's-2',
            price: 800,
            isAvailable: false,
            service: { serviceName: 'AC Repair' },
          },
        ],
      });

      const result = await service.getPublicProfile('p-1');

      expect(result.services).toHaveLength(1);
      expect(result.services[0].serviceName).toBe('Home Cleaning');
    });

    it('doesnt leak the raw providerServices relation to the public', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'p-1',
        providerServices: [],
      });

      const result = await service.getPublicProfile('p-1');

      expect(result.providerServices).toBeUndefined();
      expect(result.services).toEqual([]);
    });

    it('throws NotFoundException for a blocked or inactive provider', async () => {
      // The where clause already filters blocked and inactive providers out, so
      // it comes back null and we get a 404 rather than a hidden profile.
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.getPublicProfile('p-blocked')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('merges the changes onto the provider', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'p-1',
        providerName: 'Old Name',
        phone: '01800000000',
      });

      const result = await service.updateProfile('p-1', { providerName: 'New Name' } as any);

      expect(result.providerName).toBe('New Name');
      expect(result.phone).toBe('01800000000');
    });
  });

  describe('changePassword', () => {
    it('changes the password when the current one is right', async () => {
      const passwordHash = await bcrypt.hash('OldPassword@1', 10);
      const provider: any = { providerId: 'p-1', passwordHash };
      providerRepo.findOne.mockResolvedValue(provider);

      await service.changePassword('p-1', {
        currentPassword: 'OldPassword@1',
        newPassword: 'NewPassword@1',
      } as any);

      expect(await bcrypt.compare('NewPassword@1', provider.passwordHash)).toBe(true);
    });

    it('rejects the change when the current password is wrong', async () => {
      const passwordHash = await bcrypt.hash('OldPassword@1', 10);
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', passwordHash });

      await expect(
        service.changePassword('p-1', {
          currentPassword: 'WrongPassword@1',
          newPassword: 'NewPassword@1',
        } as any),
      ).rejects.toThrow(UnauthorizedException);

      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the provider doesnt exist', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('ghost', { currentPassword: 'x', newPassword: 'y' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addService', () => {
    it('adds a new service listing with a price', async () => {
      providerServiceRepo.findOne.mockResolvedValue(null);
      providerServiceRepo.save.mockImplementation(async (ps: any) => ({ ...ps, id: 'ps-1' }));

      const result = await service.addService('p-1', {
        serviceId: 's-1',
        price: 500,
        description: 'deep clean',
      } as any);

      expect(result.id).toBe('ps-1');
      expect(result.price).toBe(500);
      expect(result.providerId).toBe('p-1');
    });

    it('blocks listing the same service twice', async () => {
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-existing' });

      await expect(
        service.addService('p-1', { serviceId: 's-1', price: 500 } as any),
      ).rejects.toThrow(ConflictException);

      expect(providerServiceRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateService', () => {
    it('updates the price on the providers own listing', async () => {
      providerServiceRepo.findOne.mockResolvedValue({
        id: 'ps-1',
        providerId: 'p-1',
        price: 500,
      });

      const result = await service.updateService('p-1', 'ps-1', { price: 650 } as any);

      expect(result.price).toBe(650);
    });

    it('can switch a listing to unavailable', async () => {
      providerServiceRepo.findOne.mockResolvedValue({
        id: 'ps-1',
        providerId: 'p-1',
        isAvailable: true,
      });

      const result = await service.updateService('p-1', 'ps-1', { isAvailable: false } as any);

      expect(result.isAvailable).toBe(false);
    });

    it('blocks editing a listing that belongs to another provider', async () => {
      // The lookup filters on providerId too, so another provider's listing just
      // comes back as null.
      providerServiceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateService('p-2', 'ps-1', { price: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeService', () => {
    it('removes the providers own listing', async () => {
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-1', providerId: 'p-1' });

      await service.removeService('p-1', 'ps-1');

      expect(providerServiceRepo.remove).toHaveBeenCalled();
    });

    it('blocks removing a listing that isnt theirs', async () => {
      providerServiceRepo.findOne.mockResolvedValue(null);

      await expect(service.removeService('p-2', 'ps-1')).rejects.toThrow(NotFoundException);
      expect(providerServiceRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('getServices', () => {
    it('returns every listing the provider has, available or not', async () => {
      providerServiceRepo.find.mockResolvedValue([]);

      await service.getServices('p-1');

      const [options] = providerServiceRepo.find.mock.calls[0];
      expect(options.where).toEqual({ providerId: 'p-1' });
      // No isAvailable filter here on purpose. A provider needs to see their own
      // paused listings, even though customers don't.
      expect(options.where.isAvailable).toBeUndefined();
    });
  });

  describe('findAllAdmin', () => {
    it('returns providers newest first for the admin table', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAllAdmin();

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.order).toEqual({ createdAt: 'DESC' });
    });

    it('never selects the password hash even for admins', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.findAllAdmin();

      const [options] = providerRepo.find.mock.calls[0];
      expect(options.select).not.toContain('passwordHash');
    });
  });

  describe('verifyProvider', () => {
    it('marks a provider verified', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', isVerified: false });

      const result = await service.verifyProvider('p-1', true);
      expect(result.isVerified).toBe(true);
    });

    it('can take verification back off', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', isVerified: true });

      const result = await service.verifyProvider('p-1', false);
      expect(result.isVerified).toBe(false);
    });

    it('throws NotFoundException for a provider that doesnt exist', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyProvider('ghost', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('blockProvider', () => {
    it('blocks a provider', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', isBlocked: false });

      const result = await service.blockProvider('p-1', true);
      expect(result.isBlocked).toBe(true);
    });

    it('unblocks a provider', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', isBlocked: true });

      const result = await service.blockProvider('p-1', false);
      expect(result.isBlocked).toBe(false);
    });
  });

  describe('updateRating', () => {
    it('writes the new average and review count onto the provider', async () => {
      await service.updateRating('p-1', 4.5, 12);

      expect(providerRepo.update).toHaveBeenCalledWith('p-1', {
        rating: 4.5,
        totalReviews: 12,
      });
    });
  });
});
