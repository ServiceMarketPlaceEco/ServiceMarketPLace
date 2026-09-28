// Unit tests for AdminsService.
// This is everything sitting behind the admin dashboard, so I'm testing the
// stats it loads, the customer and provider lists, verifying a provider, and
// suspending or reinstating someone.
// I mock all the repos so none of this needs MySQL running.
// Run with: npm test

import { NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminsService } from './admins.service';
import { BookingStatus } from '../bookings/entities/booking.entity';

// Same little repo mock I use in the other unit tests.
const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn((x: any) => x),
  save: jest.fn(async (x: any) => x),
  remove: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('AdminsService', () => {
  let service: AdminsService;
  let adminRepo: any;
  let customerRepo: any;
  let providerRepo: any;
  let bookingRepo: any;
  let paymentRepo: any;
  let reviewRepo: any;
  let reportRepo: any;

  beforeEach(() => {
    adminRepo = mockRepo();
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    bookingRepo = mockRepo();
    paymentRepo = mockRepo();
    reviewRepo = mockRepo();
    reportRepo = mockRepo();

    service = new AdminsService(
      adminRepo,
      customerRepo,
      providerRepo,
      bookingRepo,
      paymentRepo,
      reviewRepo,
      reportRepo,
    );
  });

  describe('create', () => {
    const dto: any = {
      name: 'Test Admin',
      email: 'admin@servicehub.local',
      password: 'Password@123',
      role: 'admin',
    };

    it('creates a new admin account', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      adminRepo.save.mockImplementation(async (a: any) => ({ ...a, id: 'admin-1' }));

      const result = await service.create(dto);

      expect(adminRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('admin-1');
      expect(result.email).toBe(dto.email);
    });

    it('hashes the admin password instead of storing it plain', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      let saved: any;
      adminRepo.save.mockImplementation(async (a: any) => {
        saved = a;
        return { ...a, id: 'admin-1' };
      });

      await service.create(dto);

      expect(saved.passwordHash).toBeDefined();
      expect(saved.passwordHash).not.toBe(dto.password);
      // I check the hash properly rather than just checking it isn't the plain
      // password, because that would still pass if we hashed the wrong field.
      expect(await bcrypt.compare(dto.password, saved.passwordHash)).toBe(true);
    });

    it('throws ConflictException when that admin email already exists', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(adminRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the admin without the password hash in the selected fields', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', name: 'Test Admin' });

      const result = await service.findOne('admin-1');

      expect(result.id).toBe('admin-1');
      // The select list should never even ask for passwordHash.
      const [options] = adminRepo.findOne.mock.calls[0];
      expect(options.select).not.toContain('passwordHash');
    });

    it('throws NotFoundException for an admin id that doesnt exist', async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the admins details', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', name: 'Old Name', email: 'a@b.com' });

      const result = await service.update('admin-1', { name: 'New Name' } as any);

      expect(result.name).toBe('New Name');
      // Email should be left alone since I didn't send one.
      expect(result.email).toBe('a@b.com');
    });

    it('blocks changing the email to one another admin already uses', async () => {
      // Two lookups happen here. First one finds the admin being updated, second
      // one is the duplicate email check.
      adminRepo.findOne
        .mockResolvedValueOnce({ id: 'admin-1', email: 'a@b.com' })
        .mockResolvedValueOnce({ id: 'admin-2', email: 'taken@b.com' });

      await expect(
        service.update('admin-1', { email: 'taken@b.com' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('allows saving with the same email the admin already has', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', email: 'a@b.com' });

      const result = await service.update('admin-1', { email: 'a@b.com', name: 'Same' } as any);

      expect(result.name).toBe('Same');
    });
  });

  describe('deactivate and activate', () => {
    it('deactivate sets isActive to false', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', isActive: true });

      const result = await service.deactivate('admin-1');
      expect(result.isActive).toBe(false);
    });

    it('activate sets isActive back to true', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1', isActive: false });

      const result = await service.activate('admin-1');
      expect(result.isActive).toBe(true);
    });
  });

  describe('getDashboardStats', () => {
    // The dashboard pulls a lot of numbers at once, so this sets them all up
    // in one place instead of repeating it in every test.
    function setupCounts() {
      customerRepo.count.mockResolvedValue(25);
      providerRepo.count.mockResolvedValue(8);
      bookingRepo.count
        .mockResolvedValueOnce(40) // total bookings
        .mockResolvedValueOnce(6) // pending
        .mockResolvedValueOnce(30); // completed
      reportRepo.count.mockResolvedValue(2);
      paymentRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '12500.50' }),
      });
      bookingRepo.find.mockResolvedValue([{ bookingId: 'b-1' }]);
      reviewRepo.find.mockResolvedValue([{ reviewId: 'r-1' }]);
    }

    it('returns all the dashboard counts', async () => {
      setupCounts();

      const stats = await service.getDashboardStats();

      expect(stats.totalCustomers).toBe(25);
      expect(stats.totalProviders).toBe(8);
      expect(stats.totalBookings).toBe(40);
      expect(stats.pendingReports).toBe(2);
    });

    it('adds up revenue from completed payments as a number not a string', async () => {
      setupCounts();

      const stats = await service.getDashboardStats();

      expect(stats.totalRevenue).toBe(12500.5);
      expect(typeof stats.totalRevenue).toBe('number');
    });

    it('shows revenue as 0 when there are no payments yet', async () => {
      setupCounts();
      paymentRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: null }),
      });

      const stats = await service.getDashboardStats();

      // A brand new platform has no payments yet, and it should show 0 rather
      // than crashing or putting NaN on the admin's screen.
      expect(stats.totalRevenue).toBe(0);
    });

    it('only counts pending and completed bookings against the right statuses', async () => {
      setupCounts();

      await service.getDashboardStats();

      // The second and third count calls need to be filtered by status, otherwise
      // pending and completed would both just show the overall total.
      expect(bookingRepo.count).toHaveBeenNthCalledWith(2, {
        where: { status: BookingStatus.PENDING },
      });
      expect(bookingRepo.count).toHaveBeenNthCalledWith(3, {
        where: { status: BookingStatus.COMPLETED },
      });
    });

    it('limits the recent bookings and reviews lists to 10', async () => {
      setupCounts();

      await service.getDashboardStats();

      expect(bookingRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
      expect(reviewRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    });
  });

  describe('getAllCustomers', () => {
    it('returns the customer list with a total for the pager', async () => {
      customerRepo.findAndCount.mockResolvedValue([[{ customerId: 'c-1' }], 1]);

      const result = await service.getAllCustomers();

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('works out skip and take from the page number', async () => {
      customerRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getAllCustomers(3, 10);

      // Page 3 at 10 per page means skipping the first 20.
      expect(customerRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('never selects the customer password hash', async () => {
      customerRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getAllCustomers();

      const [options] = customerRepo.findAndCount.mock.calls[0];
      expect(options.select).not.toContain('passwordHash');
    });
  });

  describe('getAllProviders', () => {
    it('returns the provider list with a total', async () => {
      providerRepo.findAndCount.mockResolvedValue([[{ providerId: 'p-1' }], 1]);

      const result = await service.getAllProviders();

      expect(result.total).toBe(1);
    });

    it('never selects the provider password hash', async () => {
      providerRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getAllProviders();

      const [options] = providerRepo.findAndCount.mock.calls[0];
      expect(options.select).not.toContain('passwordHash');
    });
  });

  describe('verifyProvider', () => {
    it('marks the provider verified and active', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'p-1',
        isVerified: false,
        isActive: false,
      });

      const result = await service.verifyProvider('p-1');

      expect(result.isVerified).toBe(true);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException for a provider that doesnt exist', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyProvider('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suspendUser', () => {
    it('blocks and deactivates a customer', async () => {
      const customer = { customerId: 'c-1', isBlocked: false, isActive: true };
      customerRepo.findOne.mockResolvedValue(customer);

      await service.suspendUser('customer', 'c-1', 'spam');

      expect(customer.isBlocked).toBe(true);
      expect(customer.isActive).toBe(false);
      expect(customerRepo.save).toHaveBeenCalledWith(customer);
    });

    it('blocks and deactivates a provider', async () => {
      const provider = { providerId: 'p-1', isBlocked: false, isActive: true };
      providerRepo.findOne.mockResolvedValue(provider);

      await service.suspendUser('provider', 'p-1', 'fake listings');

      expect(provider.isBlocked).toBe(true);
      expect(provider.isActive).toBe(false);
    });

    it('throws NotFoundException when the customer isnt there', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.suspendUser('customer', 'ghost', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the provider isnt there', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.suspendUser('provider', 'ghost', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activateUser', () => {
    it('unblocks and reactivates a suspended customer', async () => {
      const customer = { customerId: 'c-1', isBlocked: true, isActive: false };
      customerRepo.findOne.mockResolvedValue(customer);

      await service.activateUser('customer', 'c-1');

      expect(customer.isBlocked).toBe(false);
      expect(customer.isActive).toBe(true);
    });

    it('unblocks and reactivates a suspended provider', async () => {
      const provider = { providerId: 'p-1', isBlocked: true, isActive: false };
      providerRepo.findOne.mockResolvedValue(provider);

      await service.activateUser('provider', 'p-1');

      expect(provider.isBlocked).toBe(false);
      expect(provider.isActive).toBe(true);
    });

    it('throws NotFoundException for a user that doesnt exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.activateUser('customer', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
