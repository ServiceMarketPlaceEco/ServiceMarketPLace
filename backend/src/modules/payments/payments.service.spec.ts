// Unit tests for PaymentsService.
// I'm testing that a payment gets recorded against the right booking, that you
// can only pay for your own booking, that you can't pay twice, and refunds.
//
// One thing to know before reading these: there is no payment gateway hooked
// up yet, so the service marks every payment as completed the moment it saves
// it. There's a comment saying as much in payments.service.ts. I've written
// these tests around what the code actually does rather than pretending a
// gateway exists, so if we add one later some of these will need updating.
// Run with: npm test

import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './entities/payment.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((x: any) => x),
  save: jest.fn(async (x: any) => x),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepo: any;
  let bookingRepo: any;
  let mailService: any;

  beforeEach(() => {
    paymentRepo = mockRepo();
    bookingRepo = mockRepo();
    mailService = { sendPaymentConfirmation: jest.fn() };

    service = new PaymentsService(paymentRepo, bookingRepo, mailService);
  });

  describe('create', () => {
    const dto: any = {
      bookingId: 'b-1',
      amount: 500,
      paymentMethod: 'cash',
      transactionId: 'txn-123',
    };

    // A booking that belongs to cust-1 with nothing paid on it yet.
    function ownedBooking() {
      return { bookingId: 'b-1', customerId: 'cust-1', paymentId: null };
    }

    it('takes a payment for the customers own booking', async () => {
      bookingRepo.findOne.mockResolvedValue(ownedBooking());
      paymentRepo.findOne.mockResolvedValue(null);
      paymentRepo.save.mockImplementation(async (p: any) => ({ ...p, paymentId: 'pay-1' }));

      const result = await service.create('cust-1', dto);

      expect(result.paymentId).toBe('pay-1');
      expect(result.amount).toBe(500);
      expect(result.customerId).toBe('cust-1');
    });

    it('links the new payment back onto the booking', async () => {
      const booking = ownedBooking();
      bookingRepo.findOne.mockResolvedValue(booking);
      paymentRepo.findOne.mockResolvedValue(null);
      paymentRepo.save.mockImplementation(async (p: any) => ({ ...p, paymentId: 'pay-1' }));

      await service.create('cust-1', dto);

      expect(booking.paymentId).toBe('pay-1');
      expect(bookingRepo.save).toHaveBeenCalledWith(booking);
    });

    it('sends the payment confirmation email', async () => {
      bookingRepo.findOne.mockResolvedValue(ownedBooking());
      paymentRepo.findOne.mockResolvedValue(null);
      paymentRepo.save.mockImplementation(async (p: any) => ({ ...p, paymentId: 'pay-1' }));

      await service.create('cust-1', dto);

      expect(mailService.sendPaymentConfirmation).toHaveBeenCalled();
    });

    it('marks the payment completed and stamps the date', async () => {
      // This is the no gateway behaviour and I'm pinning it down on purpose, so
      // that when we do add a gateway this test fails and tells us to update it.
      bookingRepo.findOne.mockResolvedValue(ownedBooking());
      paymentRepo.findOne.mockResolvedValue(null);
      paymentRepo.save.mockImplementation(async (p: any) => ({ ...p, paymentId: 'pay-1' }));

      const result = await service.create('cust-1', dto);

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(result.paymentDate).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when the booking doesnt exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.create('cust-1', dto)).rejects.toThrow(NotFoundException);
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('blocks paying for someone elses booking', async () => {
      bookingRepo.findOne.mockResolvedValue(ownedBooking());

      await expect(service.create('cust-2', dto)).rejects.toThrow(ForbiddenException);
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('blocks paying twice for the same booking', async () => {
      bookingRepo.findOne.mockResolvedValue(ownedBooking());
      // There's already a completed payment sitting against this booking.
      paymentRepo.findOne.mockResolvedValue({ paymentId: 'pay-existing' });

      await expect(service.create('cust-1', dto)).rejects.toThrow(BadRequestException);
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('only counts completed payments when checking for a double payment', async () => {
      bookingRepo.findOne.mockResolvedValue(ownedBooking());
      paymentRepo.findOne.mockResolvedValue(null);
      paymentRepo.save.mockImplementation(async (p: any) => ({ ...p, paymentId: 'pay-1' }));

      await service.create('cust-1', dto);

      // The duplicate check only looks at completed payments, which matters
      // because a refunded or failed one shouldn't stop someone trying again.
      const [options] = paymentRepo.findOne.mock.calls[0];
      expect(options.where.status).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('findById', () => {
    it('returns the payment when it exists', async () => {
      paymentRepo.findOne.mockResolvedValue({ paymentId: 'pay-1' });

      const result = await service.findById('pay-1');
      expect(result.paymentId).toBe('pay-1');
    });

    it('throws NotFoundException for a payment that doesnt exist', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByBooking', () => {
    it('returns null when the booking has no payment yet', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      const result = await service.findByBooking('b-1');
      expect(result).toBeNull();
    });
  });

  describe('findByCustomer', () => {
    it('only returns that customers payments', async () => {
      paymentRepo.find.mockResolvedValue([]);

      await service.findByCustomer('cust-1');

      const [options] = paymentRepo.find.mock.calls[0];
      expect(options.where.customerId).toBe('cust-1');
    });

    it('filters by status when one is passed in', async () => {
      paymentRepo.find.mockResolvedValue([]);

      await service.findByCustomer('cust-1', { status: PaymentStatus.REFUNDED } as any);

      const [options] = paymentRepo.find.mock.calls[0];
      expect(options.where.status).toBe(PaymentStatus.REFUNDED);
    });

    it('applies a date filter when a from and to date are given', async () => {
      paymentRepo.find.mockResolvedValue([]);

      await service.findByCustomer('cust-1', {
        fromDate: '2026-08-01',
        toDate: '2026-08-31',
      } as any);

      const [options] = paymentRepo.find.mock.calls[0];
      expect(options.where.paymentDate).toBeDefined();
    });

    it('returns newest payments first', async () => {
      paymentRepo.find.mockResolvedValue([]);

      await service.findByCustomer('cust-1');

      const [options] = paymentRepo.find.mock.calls[0];
      expect(options.order).toEqual({ paymentDate: 'DESC' });
    });
  });

  describe('refund', () => {
    it('refunds a completed payment', async () => {
      paymentRepo.findOne.mockResolvedValue({
        paymentId: 'pay-1',
        status: PaymentStatus.COMPLETED,
      });

      const result = await service.refund('pay-1');
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('wont refund a payment that is already refunded', async () => {
      paymentRepo.findOne.mockResolvedValue({
        paymentId: 'pay-1',
        status: PaymentStatus.REFUNDED,
      });

      await expect(service.refund('pay-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a payment that doesnt exist', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.refund('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('adds up the payment counts and revenue', async () => {
      paymentRepo.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // completed
        .mockResolvedValueOnce(2); // refunded
      paymentRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '4000' }),
      });

      const stats = await service.getStats();

      expect(stats.total).toBe(10);
      expect(stats.completed).toBe(8);
      expect(stats.refunded).toBe(2);
      expect(stats.totalRevenue).toBe('4000');
    });

    it('shows 0 revenue when nothing has been paid yet', async () => {
      paymentRepo.count.mockResolvedValue(0);
      paymentRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: null }),
      });

      const stats = await service.getStats();
      expect(stats.totalRevenue).toBe(0);
    });
  });
});
