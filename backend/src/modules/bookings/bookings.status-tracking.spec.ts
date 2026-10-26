// Unit tests for the booking status logic behind the customer's tracking page.
// Tracking in ServiceHub is status based: the admin assigns a provider, the
// provider moves the job along, and the customer's tracking page shows the
// matching stage. These tests cover the admin assignment step and the booking
// list filters that the main bookings.service.spec.ts does not reach.
// Run with: npm test

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { BookingsService } from './bookings.service';
import { BookingStatus } from './entities/booking.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(async (x: any) => x),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('BookingsService status and tracking', () => {
  let service: BookingsService;
  let bookingRepo: any;
  let providerServiceRepo: any;

  beforeEach(() => {
    bookingRepo = mockRepo();
    providerServiceRepo = mockRepo();
    service = new BookingsService(bookingRepo, providerServiceRepo, {
      sendBookingStatusUpdate: jest.fn(),
    } as any);
  });

  describe('updateStatusAdmin (admin assigns a provider and moves the booking on)', () => {
    it('assigns the providers offering and takes its price when the booking had none', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', jobId: 's-1', totalAmount: null, status: BookingStatus.PENDING });
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-7', price: 750 });

      const result = await service.updateStatusAdmin('bk-1', 'Accepted', 'prov-3');

      expect(providerServiceRepo.findOne).toHaveBeenCalledWith({ where: { providerId: 'prov-3', serviceId: 's-1' } });
      expect(result).toMatchObject({ providerServiceId: 'ps-7', totalAmount: 750, status: BookingStatus.CONFIRMED });
    });

    it('keeps the agreed price if the booking already has one', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', jobId: 's-1', totalAmount: 500 });
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps-7', price: 750 });

      const result = await service.updateStatusAdmin('bk-1', 'confirmed', 'prov-3');

      expect(result.totalAmount).toBe(500);
    });

    it('refuses a provider who does not offer the booked service', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', jobId: 's-1', totalAmount: null });
      providerServiceRepo.findOne.mockResolvedValue(null);

      await expect(service.updateStatusAdmin('bk-1', 'confirmed', 'prov-3')).rejects.toThrow(
        'Selected provider does not offer this service',
      );
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it('refuses to assign a provider to a booking with no service on it', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', jobId: null });

      await expect(service.updateStatusAdmin('bk-1', 'confirmed', 'prov-3')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a booking that doesnt exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(service.updateStatusAdmin('ghost', 'confirmed')).rejects.toThrow(NotFoundException);
    });

    it.each([
      ['pending', BookingStatus.PENDING],
      ['Pending', BookingStatus.PENDING],
      ['accepted', BookingStatus.CONFIRMED],
      ['Confirmed', BookingStatus.CONFIRMED],
      ['in_progress', BookingStatus.IN_PROGRESS],
      ['In Progress', BookingStatus.IN_PROGRESS],
      ['completed', BookingStatus.COMPLETED],
      ['Completed', BookingStatus.COMPLETED],
      ['cancelled', BookingStatus.CANCELLED],
      ['Cancelled', BookingStatus.CANCELLED],
    ])('turns the label "%s" into the %s status the tracking page reads', async (label, expected) => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', status: BookingStatus.PENDING });

      const result = await service.updateStatusAdmin('bk-1', label);

      expect(result.status).toBe(expected);
    });

    it('does not check the order of steps, unlike the provider route', async () => {
      // Recorded on purpose: an admin (or, today, anyone, because the route is
      // public) can jump a booking straight from completed back to pending.
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', status: BookingStatus.COMPLETED });

      const result = await service.updateStatusAdmin('bk-1', 'pending');

      expect(result.status).toBe(BookingStatus.PENDING);
    });
  });

  describe('findByCustomer date filters', () => {
    beforeEach(() => bookingRepo.find.mockResolvedValue([]));

    it('filters by status and a full date range', async () => {
      await service.findByCustomer('c-1', { status: 'pending', fromDate: '2026-10-01', toDate: '2026-10-31' } as any);

      const { where } = bookingRepo.find.mock.calls[0][0];
      expect(where.status).toBe('pending');
      expect(where.date).toEqual(Between(new Date('2026-10-01'), new Date('2026-10-31')));
    });

    it('uses "from this date on" when only a start date is given', async () => {
      await service.findByCustomer('c-1', { fromDate: '2026-10-01' } as any);
      expect(bookingRepo.find.mock.calls[0][0].where.date).toEqual(MoreThanOrEqual(new Date('2026-10-01')));
    });

    it('uses "up to this date" when only an end date is given', async () => {
      await service.findByCustomer('c-1', { toDate: '2026-10-31' } as any);
      expect(bookingRepo.find.mock.calls[0][0].where.date).toEqual(LessThanOrEqual(new Date('2026-10-31')));
    });

    it('shows the newest bookings first with the provider and service attached', async () => {
      await service.findByCustomer('c-1');
      const options = bookingRepo.find.mock.calls[0][0];
      expect(options.where).toEqual({ customerId: 'c-1' });
      expect(options.order).toEqual({ date: 'DESC', time: 'DESC' });
      expect(options.relations).toContain('providerService.provider');
    });
  });

  describe('findByProvider filters', () => {
    it('adds the status and date filters to the providers job list', async () => {
      providerServiceRepo.find.mockResolvedValue([{ id: 'ps-1' }]);
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findByProvider('prov-1', { status: 'confirmed', fromDate: '2026-10-01', toDate: '2026-10-31' } as any);

      expect(qb.andWhere).toHaveBeenCalledWith('booking.status = :status', { status: 'confirmed' });
      expect(qb.andWhere).toHaveBeenCalledWith('booking.date >= :fromDate', { fromDate: '2026-10-01' });
      expect(qb.andWhere).toHaveBeenCalledWith('booking.date <= :toDate', { toDate: '2026-10-31' });
    });
  });

  describe('findAll (admin list)', () => {
    it('filters by status and date range, newest first, with all the details the dashboard shows', async () => {
      bookingRepo.find.mockResolvedValue([]);

      await service.findAll({ status: 'pending', fromDate: '2026-10-01', toDate: '2026-10-31' } as any);

      const options = bookingRepo.find.mock.calls[0][0];
      expect(options.where).toEqual({
        status: 'pending',
        date: Between(new Date('2026-10-01'), new Date('2026-10-31')),
      });
      expect(options.order).toEqual({ createdAt: 'DESC' });
      expect(options.relations).toEqual(['customer', 'providerService', 'providerService.provider', 'providerService.service']);
    });
  });

  describe('update (customer edits a pending booking)', () => {
    it('changes the date, time, notes and address', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', customerId: 'c-1', status: BookingStatus.PENDING });

      const result = await service.update('c-1', 'bk-1', {
        date: '2026-11-02',
        time: '10:30',
        notes: 'Please bring a ladder',
        address: 'Shaheb Bazar',
      } as any);

      expect(result).toMatchObject({ time: '10:30', notes: 'Please bring a ladder', address: 'Shaheb Bazar' });
      expect(result.date).toEqual(new Date('2026-11-02'));
    });

    it('clears the address when an empty one is sent', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'bk-1', customerId: 'c-1', status: BookingStatus.PENDING, address: 'Old' });

      const result = await service.update('c-1', 'bk-1', { address: '' } as any);

      expect(result.address).toBeNull();
    });
  });
});
