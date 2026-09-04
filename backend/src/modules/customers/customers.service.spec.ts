// Unit tests for CustomersService.
// This covers the customer profile page, changing a password, and the block
// and unblock action the admin uses.
// The repo is mocked so I don't need a database for any of it.
// Run with: npm test

import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CustomersService } from './customers.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(async (x: any) => x),
});

describe('CustomersService', () => {
  let service: CustomersService;
  let repo: any;

  beforeEach(() => {
    repo = mockRepo();
    service = new CustomersService(repo);
  });

  describe('findById', () => {
    it('returns the customer when they exist', async () => {
      repo.findOne.mockResolvedValue({ customerId: 'c-1', name: 'Test Customer' });

      const result = await service.findById('c-1');
      expect(result.name).toBe('Test Customer');
    });

    it('throws NotFoundException for an id that doesnt exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfile', () => {
    it('returns the profile fields', async () => {
      repo.findOne.mockResolvedValue({ customerId: 'c-1', name: 'Test Customer' });

      const result = await service.getProfile('c-1');
      expect(result.customerId).toBe('c-1');
    });

    it('never selects the password hash for the profile page', async () => {
      repo.findOne.mockResolvedValue({ customerId: 'c-1' });

      await service.getProfile('c-1');

      const [options] = repo.findOne.mock.calls[0];
      expect(options.select).not.toContain('passwordHash');
    });

    it('throws NotFoundException when the customer isnt there', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('merges the new details onto the existing customer', async () => {
      repo.findOne.mockResolvedValue({
        customerId: 'c-1',
        name: 'Old Name',
        phone: '01700000000',
        address: 'Boalia',
      });

      const result = await service.updateProfile('c-1', { name: 'New Name' } as any);

      expect(result.name).toBe('New Name');
      // Anything I didn't send should be left exactly as it was.
      expect(result.address).toBe('Boalia');
    });

    it('throws NotFoundException when updating a customer that doesnt exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.updateProfile('ghost', { name: 'x' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('changePassword', () => {
    it('changes the password when the current one is right', async () => {
      const passwordHash = await bcrypt.hash('OldPassword@1', 10);
      const customer: any = { customerId: 'c-1', passwordHash };
      repo.findOne.mockResolvedValue(customer);

      await service.changePassword('c-1', {
        currentPassword: 'OldPassword@1',
        newPassword: 'NewPassword@1',
      } as any);

      expect(repo.save).toHaveBeenCalled();
      // The stored hash should match the new password now and not the old one.
      // Checking both directions because only checking one would miss a bug where
      // the password never actually changed.
      expect(await bcrypt.compare('NewPassword@1', customer.passwordHash)).toBe(true);
      expect(await bcrypt.compare('OldPassword@1', customer.passwordHash)).toBe(false);
    });

    it('rejects the change when the current password is wrong', async () => {
      const passwordHash = await bcrypt.hash('OldPassword@1', 10);
      repo.findOne.mockResolvedValue({ customerId: 'c-1', passwordHash });

      await expect(
        service.changePassword('c-1', {
          currentPassword: 'WrongPassword@1',
          newPassword: 'NewPassword@1',
        } as any),
      ).rejects.toThrow(UnauthorizedException);

      // A failed attempt must not save anything at all.
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the customer doesnt exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('ghost', {
          currentPassword: 'x',
          newPassword: 'y',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateAccount', () => {
    it('sets the account inactive rather than deleting the row', async () => {
      const customer: any = { customerId: 'c-1', isActive: true };
      repo.findOne.mockResolvedValue(customer);

      await service.deactivateAccount('c-1');

      expect(customer.isActive).toBe(false);
      expect(repo.save).toHaveBeenCalledWith(customer);
    });
  });

  describe('findAll', () => {
    it('returns customers newest first for the admin list', async () => {
      repo.find.mockResolvedValue([{ customerId: 'c-1' }]);

      await service.findAll();

      const [options] = repo.find.mock.calls[0];
      expect(options.order).toEqual({ createdAt: 'DESC' });
    });

    it('never selects the password hash for the admin list', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll();

      const [options] = repo.find.mock.calls[0];
      expect(options.select).not.toContain('passwordHash');
    });
  });

  describe('blockCustomer', () => {
    it('blocks a customer', async () => {
      repo.findOne.mockResolvedValue({ customerId: 'c-1', isBlocked: false });

      const result = await service.blockCustomer('c-1', true);
      expect(result.isBlocked).toBe(true);
    });

    it('unblocks a customer', async () => {
      repo.findOne.mockResolvedValue({ customerId: 'c-1', isBlocked: true });

      const result = await service.blockCustomer('c-1', false);
      expect(result.isBlocked).toBe(false);
    });

    it('throws NotFoundException for a customer that doesnt exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.blockCustomer('ghost', true)).rejects.toThrow(NotFoundException);
    });
  });
});
