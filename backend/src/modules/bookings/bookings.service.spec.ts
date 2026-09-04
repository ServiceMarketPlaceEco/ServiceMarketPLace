// unit tests for BookingsService
// covers creating bookings, the ownership checks and the status transition rules
// run with: npm test

import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingStatus } from './entities/booking.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(async (x: any) => x),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingRepo: any;
  let providerServiceRepo: any;
  let mailService: any;

  beforeEach(() => {
    bookingRepo = mockRepo();
    providerServiceRepo = mockRepo();
    mailService = {
      sendBookingConfirmation: jest.fn(),
      sendBookingCancellation: jest.fn(),
      sendBookingStatusUpdate: jest.fn(),
    };

    service = new BookingsService(bookingRepo, providerServiceRepo, mailService);
  });

  describe('create', () => {
    it('creates a quick booking without a provider service (customer just describes the job)', async () => {
      const dto: any = {
        date: '2026-09-01',
        time: '10:00',
        serviceName: 'Home Cleaning',
        address: 'Rajshahi',
      };

      const result = await service.create('cust-1', dto);

      expect(bookingRepo.save).toHaveBeenCalled();
      expect(result.customerId).toBe('cust-1');
      expect(result.status).toBe(BookingStatus.PENDING);
      // no provider picked yet so no amount either
      expect(result.totalAmount).toBeNull();
      // no provider means no confirmation email yet
      expect(mailService.sendBookingConfirmation).not.toHaveBeenCalled();
    });

    it('creates a booking against a real provider service and grabs the price', async () => {
      providerServiceRepo.findOne.mockResolvedValue({
        id: 'ps-1',
        price: 500,
        isAvailable: true,
        provider: { isBlocked: false, isActive: true },
        service: { serviceName: 'AC Repair' },
      });

      const dto: any = { providerServiceId: 'ps-1', date: '2026-09-01', time: '14:00' };
      const result = await service.create('cust-1', dto);

      expect(result.totalAmount).toBe(500);
      expect(result.serviceName).toBe('AC Repair');
      expect(mailService.sendBookingConfirmation).toHaveBeenCalled();
    });

    it('throws NotFoundException when the provider service doesnt exist', async () => {
      providerServiceRepo.findOne.mockResolvedValue(null);

      const dto: any = { providerServiceId: 'nope', date: '2026-09-01', time: '10:00' };
      await expect(service.create('cust-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('rejects booking when the provider is blocked', async () => {
      providerServiceRepo.findOne.mockResolvedValue({
        id: 'ps-1',
        price: 500,
        isAvailable: true,
        provider: { isBlocked: true, isActive: true },
        service: { serviceName: 'AC Repair' },
      });

      const dto: any = { providerServiceId: 'ps-1', date: '2026-09-01', time: '10:00' };
      await expect(service.create('cust-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('still saves the booking even if the confirmation email fails', async () => {
      // email breaking shouldnt lose the customers booking
      providerServiceRepo.findOne.mockResolvedValue({
        id: 'ps-1',
        price: 500,
        isAvailable: true,
        provider: { isBlocked: false, isActive: true },
        service: { serviceName: 'AC Repair' },
      });
      mailService.sendBookingConfirmation.mockRejectedValue(new Error('smtp down'));

      const dto: any = { providerServiceId: 'ps-1', date: '2026-09-01', time: '10:00' };
      const result = await service.create('cust-1', dto);

      expect(result).toBeDefined();
      expect(bookingRepo.save).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the booking when it exists', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-1' });

      const result = await service.findById('b-1');
      expect(result.bookingId).toBe('b-1');
    });

    it('throws NotFoundException when it doesnt', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProvider', () => {
    it('returns empty list when the provider has no services yet', async () => {
      providerServiceRepo.find.mockResolvedValue([]);

      const result = await service.findByProvider('prov-1');
      expect(result).toEqual([]);
      // shouldnt even bother querying bookings in that case
      expect(bookingRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('lets the owner update their own pending booking', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 'b-1',
        customerId: 'cust-1',
        status: BookingStatus.PENDING,
        notes: 'old note',
      });

      const result = await service.update('cust-1', 'b-1', { notes: 'new note' } as any);
      expect(result.notes).toBe('new note');
    });

    it('blocks updating someone elses booking', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 'b-1',
        customerId: 'cust-1',
        status: BookingStatus.PENDING,
      });

      await expect(service.update('cust-2', 'b-1', {} as any)).rejects.toThrow(ForbiddenException);
    });

    it('blocks updating a booking thats already confirmed', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 'b-1',
        customerId: 'cust-1',
        status: BookingStatus.CONFIRMED,
      });

      await expect(service.update('cust-1', 'b-1', {} as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('cancels a pending booking and sends the cancellation email', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 'b-1',
        customerId: 'cust-1',
        status: BookingStatus.PENDING,
      });

      const result = await service.cancel('cust-1', 'b-1');

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(mailService.sendBookingCancellation).toHaveBeenCalled();
    });

    it('cant cancel a completed booking', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 'b-1',
        customerId: 'cust-1',
        status: BookingStatus.COMPLETED,
      });

      await expect(service.cancel('cust-1', 'b-1')).rejects.toThrow(BadRequestException);
    });

    it('cant cancel someone elses booking', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 'b-1',
        customerId: 'cust-1',
        status: BookingStatus.PENDING,
      });

      await expect(service.cancel('cust-2', 'b-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatusByProvider', () => {
    // helper for a booking that belongs to prov-1
    const bookingWith = (status: BookingStatus) => ({
      bookingId: 'b-1',
      customerId: 'cust-1',
      status,
      providerService: { providerId: 'prov-1' },
    });

    it('lets the provider confirm a pending booking', async () => {
      bookingRepo.findOne.mockResolvedValue(bookingWith(BookingStatus.PENDING));

      const result = await service.updateStatusByProvider('prov-1', 'b-1', 'confirmed');

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(mailService.sendBookingStatusUpdate).toHaveBeenCalled();
    });

    it('blocks skipping straight from pending to completed', async () => {
      // has to go pending -> confirmed -> in_progress -> completed
      bookingRepo.findOne.mockResolvedValue(bookingWith(BookingStatus.PENDING));

      await expect(
        service.updateStatusByProvider('prov-1', 'b-1', 'completed'),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks changing a completed booking at all', async () => {
      bookingRepo.findOne.mockResolvedValue(bookingWith(BookingStatus.COMPLETED));

      await expect(
        service.updateStatusByProvider('prov-1', 'b-1', 'cancelled'),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks a different provider from touching the booking', async () => {
      bookingRepo.findOne.mockResolvedValue(bookingWith(BookingStatus.PENDING));

      await expect(
        service.updateStatusByProvider('prov-2', 'b-1', 'confirmed'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatusAdmin', () => {
    it('maps the frontend status labels like Accepted to the right enum', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-1', status: BookingStatus.PENDING });

      const result = await service.updateStatusAdmin('b-1', 'Accepted');
      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it('throws for a status string it doesnt recognise', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-1', status: BookingStatus.PENDING });

      await expect(service.updateStatusAdmin('b-1', 'banana')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('adds up the booking counts per status', async () => {
      // count gets called 6 times, first is total then one per status
      bookingRepo.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const stats = await service.getStats();

      expect(stats).toEqual({
        total: 10,
        pending: 4,
        confirmed: 2,
        inProgress: 1,
        completed: 2,
        cancelled: 1,
      });
    });
  });
});
