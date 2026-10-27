// Unit tests for AccountModerationService.
// This is the part that gathers every provider and customer, works out the
// numbers the fake-account detector needs (completed bookings, reviews written,
// how many different providers they reviewed), and the admin's block/keep actions.
// The detector's own scoring rules are tested in fake-account-detector.spec.ts,
// so here we check what is handed to it and what the admin actions change.
// Run with: npm test

import { NotFoundException } from '@nestjs/common';
import { AccountModerationService } from './account-moderation.service';
import * as detector from './fake-account-detector';
import { BookingStatus } from '../../bookings/entities/booking.entity';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  save: jest.fn(async (x: any) => x),
});

describe('AccountModerationService', () => {
  let service: AccountModerationService;
  let providerRepo: any;
  let customerRepo: any;
  let bookingRepo: any;
  let reviewRepo: any;

  beforeEach(() => {
    providerRepo = mockRepo();
    customerRepo = mockRepo();
    bookingRepo = mockRepo();
    reviewRepo = mockRepo();
    service = new AccountModerationService(providerRepo, customerRepo, bookingRepo, reviewRepo);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('scanAllAccounts', () => {
    it('builds one scorable record per provider and customer with their activity numbers', async () => {
      const created = new Date('2026-10-01');
      providerRepo.find.mockResolvedValue([
        { providerId: 'p-1', email: 'p@x.com', phone: 8801700000000, createdAt: created, abn: 123 },
      ]);
      customerRepo.find.mockResolvedValue([
        { customerId: 'c-1', email: 'c@x.com', phone: null, createdAt: created },
      ]);
      // provider has 3 completed jobs, customer has 1
      bookingRepo.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
      // the customer wrote 3 reviews about 2 different providers
      reviewRepo.find.mockResolvedValue([{ providerId: 'p-1' }, { providerId: 'p-1' }, { providerId: 'p-2' }]);
      const scan = jest.spyOn(detector, 'scanAccounts').mockReturnValue([]);

      await service.scanAllAccounts();

      const [scorable, config] = scan.mock.calls[0];
      expect(config).toBe(detector.ACCOUNT_DETECTION_CONFIG);
      expect(scorable).toEqual([
        {
          accountId: 'p-1',
          kind: 'provider',
          email: 'p@x.com',
          phone: '8801700000000', // numbers are turned into text for the phone checks
          createdAt: created,
          // the ABN (123) is NOT passed on as the nid any more - see the L8 test below
          completedBookings: 3,
        },
        {
          accountId: 'c-1',
          kind: 'customer',
          email: 'c@x.com',
          phone: null,
          createdAt: created,
          completedBookings: 1,
          reviewsWritten: 3,
          distinctProvidersReviewed: 2,
        },
      ]);
    });

    it('only counts completed bookings, not pending or cancelled ones', async () => {
      providerRepo.find.mockResolvedValue([{ providerId: 'p-1', createdAt: new Date() }]);
      customerRepo.find.mockResolvedValue([{ customerId: 'c-1', createdAt: new Date() }]);
      bookingRepo.count.mockResolvedValue(0);
      reviewRepo.find.mockResolvedValue([]);
      jest.spyOn(detector, 'scanAccounts').mockReturnValue([]);

      await service.scanAllAccounts();

      // one count per provider and per customer, so the loop below really checks something
      expect(bookingRepo.count).toHaveBeenCalledTimes(2);
      for (const [options] of bookingRepo.count.mock.calls) {
        expect(options.where.status).toBe(BookingStatus.COMPLETED);
      }
    });

    it('returns whatever the detector flags, using the real detector end to end', async () => {
      // two brand new provider accounts sharing one phone number is a classic fake pattern
      const now = new Date();
      providerRepo.find.mockResolvedValue([
        { providerId: 'p-1', email: 'a@x.com', phone: 1711111111, createdAt: now, abn: null },
        { providerId: 'p-2', email: 'b@x.com', phone: 1711111111, createdAt: now, abn: null },
      ]);
      customerRepo.find.mockResolvedValue([]);
      bookingRepo.count.mockResolvedValue(0);

      const flagged = await service.scanAllAccounts();

      // every flag carries a plain-English reason for the admin
      for (const account of flagged) {
        expect(account.reasons.length).toBeGreaterThan(0);
        for (const reason of account.reasons) expect(typeof reason.detail).toBe('string');
      }
      expect(flagged.map((a) => a.accountId).sort()).toEqual(['p-1', 'p-2']);
    });

    // L8 in the qa report - an australian ABN isnt a bangladesh NID, so passing
    // it in made every provider with an ABN look like they had a fake NID
    it('does not flag a provider as having an invalid NID just because they gave an ABN', async () => {
      providerRepo.find.mockResolvedValue([
        // 11 digits, a normal ABN. as a nid it would fail (needs 10, 13 or 17)
        { providerId: 'p-1', email: 'p@x.com', phone: null, createdAt: new Date('2025-01-01'), abn: 51824753556 },
      ]);
      customerRepo.find.mockResolvedValue([]);
      bookingRepo.count.mockResolvedValue(5);

      const flagged = await service.scanAllAccounts();

      const signals = flagged.flatMap((a) => a.reasons.map((r) => r.signal));
      expect(signals).not.toContain('INVALID_NID');
    });

    it('returns an empty queue when there are no accounts', async () => {
      providerRepo.find.mockResolvedValue([]);
      customerRepo.find.mockResolvedValue([]);
      expect(await service.scanAllAccounts()).toEqual([]);
    });
  });

  describe('blockAccount', () => {
    it('blocks and deactivates a provider', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1', isBlocked: false, isActive: true });

      const result = await service.blockAccount('p-1', 'provider');

      expect(result).toEqual({ accountId: 'p-1', blocked: true });
      expect(providerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isBlocked: true, isActive: false }));
      expect(customerRepo.save).not.toHaveBeenCalled();
    });

    it('blocks and deactivates a customer', async () => {
      customerRepo.findOne.mockResolvedValue({ customerId: 'c-1', isBlocked: false, isActive: true });

      const result = await service.blockAccount('c-1', 'customer');

      expect(result).toEqual({ accountId: 'c-1', blocked: true });
      expect(customerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isBlocked: true, isActive: false }));
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown provider', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(service.blockAccount('ghost', 'provider')).rejects.toThrow('Provider not found');
    });

    it('throws NotFoundException for an unknown customer', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.blockAccount('ghost', 'customer')).rejects.toThrow('Customer not found');
    });
  });

  describe('keepAccount', () => {
    it('confirms a provider exists and changes nothing', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1' });

      expect(await service.keepAccount('p-1')).toEqual({ accountId: 'p-1', kept: true });
      expect(customerRepo.findOne).not.toHaveBeenCalled();
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('falls back to customers when the id is not a provider', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      customerRepo.findOne.mockResolvedValue({ customerId: 'c-1' });

      expect(await service.keepAccount('c-1')).toEqual({ accountId: 'c-1', kept: true });
    });

    it('throws NotFoundException when no account has that id', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.keepAccount('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
