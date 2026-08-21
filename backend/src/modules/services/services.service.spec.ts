// unit tests for ServicesService
// this one is the services catalog (home cleaning, ac repair etc)
// run with: npm test

import { NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((x: any) => x),
  save: jest.fn(async (x: any) => x),
  remove: jest.fn(),
});

describe('ServicesService', () => {
  let service: ServicesService;
  let repo: any;

  beforeEach(() => {
    repo = mockRepo();
    service = new ServicesService(repo);
  });

  describe('findAll', () => {
    it('only returns active services for the public catalog', async () => {
      repo.find.mockResolvedValue([{ serviceName: 'AC Repair' }]);

      await service.findAll();

      // check the where clause actually filters on isActive
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the service when found', async () => {
      repo.findOne.mockResolvedValue({ serviceId: 's-1', serviceName: 'Home Cleaning' });

      const result = await service.findOne('s-1');
      expect(result.serviceName).toBe('Home Cleaning');
    });

    it('throws NotFoundException when the id doesnt exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findProvidersForService', () => {
    it('filters out unavailable, blocked and inactive providers', async () => {
      repo.findOne.mockResolvedValue({
        serviceId: 's-1',
        providerServices: [
          {
            id: 'ps-good',
            isAvailable: true,
            price: 500,
            provider: { providerId: 'p1', providerName: 'Good Provider', isActive: true, isBlocked: false },
          },
          {
            id: 'ps-blocked',
            isAvailable: true,
            price: 400,
            provider: { providerId: 'p2', providerName: 'Blocked Provider', isActive: true, isBlocked: true },
          },
          {
            id: 'ps-off',
            isAvailable: false,
            price: 300,
            provider: { providerId: 'p3', providerName: 'Paused Provider', isActive: true, isBlocked: false },
          },
        ],
      });

      const result = await service.findProvidersForService('s-1');

      // only the good one should survive the filter
      expect(result).toHaveLength(1);
      expect(result[0].providerName).toBe('Good Provider');
      expect(result[0].price).toBe(500);
    });

    it('throws NotFoundException for a service that doesnt exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findProvidersForService('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges the changes onto the existing service', async () => {
      repo.findOne.mockResolvedValue({ serviceId: 's-1', serviceName: 'Old Name', icon: 'home' });

      const result = await service.update('s-1', { serviceName: 'New Name' } as any);

      expect(result.serviceName).toBe('New Name');
      // untouched fields should stay the same
      expect(result.icon).toBe('home');
    });
  });

  describe('remove', () => {
    it('removes an existing service', async () => {
      repo.findOne.mockResolvedValue({ serviceId: 's-1' });

      await service.remove('s-1');
      expect(repo.remove).toHaveBeenCalled();
    });

    it('throws when trying to remove a service that isnt there', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
