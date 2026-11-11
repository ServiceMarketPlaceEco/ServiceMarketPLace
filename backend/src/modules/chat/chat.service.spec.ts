// Unit tests for ChatService: customer <-> provider chat on a booking.
// Covers who may ask for chat, the admin approval gate, who may read and send,
// and that the sender's role always comes from their login.
// Run with: npm test

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatApprovalStatus } from './entities/chat-approval.entity';
import { BookingStatus } from '../bookings/entities/booking.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((x: any) => ({ ...x })),
  save: jest.fn(async (x: any) => ({ id: x.id ?? 'new-id', createdAt: new Date('2026-11-06T10:00:00Z'), ...x })),
  createQueryBuilder: jest.fn(),
});

const customer = { userId: 'cust-1', userType: 'customer' as const };
const otherCustomer = { userId: 'cust-2', userType: 'customer' as const };
const provider = { userId: 'prov-1', userType: 'provider' as const };
const otherProvider = { userId: 'prov-2', userType: 'provider' as const };
const admin = { userId: 'admin-1', userType: 'admin' as const };

const booking = (overrides: any = {}) => ({
  bookingId: 'bk-1',
  customerId: 'cust-1',
  providerServiceId: 'ps-1',
  status: BookingStatus.CONFIRMED,
  serviceName: 'Home Cleaning',
  customer: { name: 'Rahim', passwordHash: 'secret' },
  providerService: { providerId: 'prov-1', provider: { providerName: 'Karim Services', passwordHash: 'secret' } },
  ...overrides,
});

// fake query builder that records the where clause and returns `rows`
const fakeQb = (rows: any[]) => {
  const qb: any = { whereCalls: [] as any[] };
  for (const m of ['innerJoinAndSelect', 'leftJoinAndSelect', 'innerJoin', 'leftJoin', 'orderBy']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.where = jest.fn((sql: string, params: any) => (qb.whereCalls.push({ sql, params }), qb));
  qb.getMany = jest.fn(async () => rows);
  return qb;
};

describe('ChatService', () => {
  let service: ChatService;
  let approvalRepo: any;
  let messageRepo: any;
  let bookingRepo: any;

  beforeEach(() => {
    approvalRepo = mockRepo();
    messageRepo = mockRepo();
    bookingRepo = mockRepo();
    bookingRepo.findOne.mockResolvedValue(booking());
    service = new ChatService(approvalRepo, messageRepo, bookingRepo);
  });

  describe('requestApproval', () => {
    it('lets the customer ask for chat on their booking', async () => {
      approvalRepo.findOne.mockResolvedValue(null);

      const result = await service.requestApproval(customer, 'bk-1');

      expect(result).toMatchObject({
        bookingId: 'bk-1',
        requestedBy: 'customer',
        status: ChatApprovalStatus.PENDING,
        customerName: 'Rahim',
        providerName: 'Karim Services',
        serviceName: 'Home Cleaning',
      });
      expect(approvalRepo.save).toHaveBeenCalledWith(expect.objectContaining({ requestedById: 'cust-1' }));
    });

    it('lets the assigned provider ask for chat', async () => {
      approvalRepo.findOne.mockResolvedValue(null);
      const result = await service.requestApproval(provider, 'bk-1');
      expect(result.requestedBy).toBe('provider');
    });

    it('never puts password hashes in the response', async () => {
      approvalRepo.findOne.mockResolvedValue(null);
      const result = await service.requestApproval(customer, 'bk-1');
      expect(JSON.stringify(result)).not.toContain('secret');
    });

    it('refuses someone who is not on the booking', async () => {
      await expect(service.requestApproval(otherCustomer, 'bk-1')).rejects.toThrow(ForbiddenException);
      await expect(service.requestApproval(otherProvider, 'bk-1')).rejects.toThrow(ForbiddenException);
      await expect(service.requestApproval(admin, 'bk-1')).rejects.toThrow(ForbiddenException);
      expect(approvalRepo.save).not.toHaveBeenCalled();
    });

    it('refuses until a provider is assigned', async () => {
      bookingRepo.findOne.mockResolvedValue(booking({ providerServiceId: null, providerService: null }));
      await expect(service.requestApproval(customer, 'bk-1')).rejects.toThrow(BadRequestException);
    });

    it('refuses on a cancelled booking', async () => {
      bookingRepo.findOne.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));
      await expect(service.requestApproval(customer, 'bk-1')).rejects.toThrow(BadRequestException);
    });

    it('returns 404 for an unknown booking', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(service.requestApproval(customer, 'nope')).rejects.toThrow(NotFoundException);
    });

    it('does not create a second request while one is pending or approved', async () => {
      approvalRepo.findOne.mockResolvedValue({ id: 'ap-1', bookingId: 'bk-1', requestedBy: 'provider', status: ChatApprovalStatus.APPROVED });

      const result = await service.requestApproval(customer, 'bk-1');

      expect(result).toMatchObject({ id: 'ap-1', status: ChatApprovalStatus.APPROVED, requestedBy: 'provider' });
      expect(approvalRepo.save).not.toHaveBeenCalled();
    });

    it('puts a rejected request back in the queue when asked again', async () => {
      approvalRepo.findOne.mockResolvedValue({
        id: 'ap-1', bookingId: 'bk-1', requestedBy: 'provider', status: ChatApprovalStatus.REJECTED,
        reviewedBy: 'admin-1', reviewedAt: new Date(),
      });

      const result = await service.requestApproval(customer, 'bk-1');

      expect(result).toMatchObject({ id: 'ap-1', status: ChatApprovalStatus.PENDING, requestedBy: 'customer', reviewedAt: null });
    });
  });

  describe('reviewApproval', () => {
    it('lets the admin approve and records who did it', async () => {
      approvalRepo.findOne.mockResolvedValue({ id: 'ap-1', bookingId: 'bk-1', status: ChatApprovalStatus.PENDING, booking: booking() });

      const result = await service.reviewApproval('admin-1', 'ap-1', 'approved');

      expect(result.status).toBe(ChatApprovalStatus.APPROVED);
      expect(approvalRepo.save).toHaveBeenCalledWith(expect.objectContaining({ reviewedBy: 'admin-1', reviewedAt: expect.any(Date) }));
    });

    it('lets the admin reject', async () => {
      approvalRepo.findOne.mockResolvedValue({ id: 'ap-1', bookingId: 'bk-1', status: ChatApprovalStatus.PENDING, booking: booking() });
      expect((await service.reviewApproval('admin-1', 'ap-1', 'rejected')).status).toBe(ChatApprovalStatus.REJECTED);
    });

    it('returns 404 for an unknown approval', async () => {
      approvalRepo.findOne.mockResolvedValue(null);
      await expect(service.reviewApproval('admin-1', 'nope', 'approved')).rejects.toThrow(NotFoundException);
    });
  });

  // emails are an extra on top of the chat: the admin team hears about a
  // new request, and both sides hear the decision
  describe('notifications', () => {
    let mail: any;
    let notifier: any;

    beforeEach(() => {
      mail = { sendChatDecision: jest.fn() };
      notifier = { notify: jest.fn() };
      service = new ChatService(approvalRepo, messageRepo, bookingRepo, mail, notifier);
    });

    it('tells the admin team about a new chat request', async () => {
      approvalRepo.findOne.mockResolvedValue(null);

      await service.requestApproval(customer, 'bk-1');

      expect(notifier.notify).toHaveBeenCalledWith(
        'Chat request waiting for approval',
        expect.stringContaining('Rahim asked to open chat on Home Cleaning'),
      );
    });

    it('does not email again when the request already exists', async () => {
      approvalRepo.findOne.mockResolvedValue({ id: 'ap-1', bookingId: 'bk-1', status: ChatApprovalStatus.PENDING });

      await service.requestApproval(customer, 'bk-1');

      expect(notifier.notify).not.toHaveBeenCalled();
    });

    it('emails the customer and the provider when the admin approves', async () => {
      const b: any = booking();
      b.customer = { ...b.customer, email: 'rahim@x.com' };
      b.providerService.provider = { ...b.providerService.provider, email: 'karim@x.com' };
      approvalRepo.findOne.mockResolvedValue({ id: 'ap-1', bookingId: 'bk-1', status: ChatApprovalStatus.PENDING, booking: b });

      await service.reviewApproval('admin-1', 'ap-1', 'approved');

      expect(mail.sendChatDecision).toHaveBeenCalledWith('rahim@x.com', 'Rahim', 'Home Cleaning', true);
      expect(mail.sendChatDecision).toHaveBeenCalledWith('karim@x.com', 'Karim Services', 'Home Cleaning', true);
    });

    it('still saves the decision when the email fails', async () => {
      const b: any = booking();
      b.customer = { ...b.customer, email: 'rahim@x.com' };
      approvalRepo.findOne.mockResolvedValue({ id: 'ap-1', bookingId: 'bk-1', status: ChatApprovalStatus.PENDING, booking: b });
      mail.sendChatDecision.mockRejectedValue(new Error('smtp down'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await service.reviewApproval('admin-1', 'ap-1', 'rejected');

      expect(result.status).toBe(ChatApprovalStatus.REJECTED);
    });
  });

  describe('listApprovals', () => {
    it('filters to the customer\'s own bookings', async () => {
      const qb = fakeQb([{ id: 'ap-1', bookingId: 'bk-1', status: 'pending', booking: booking() }]);
      approvalRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listApprovals(customer);

      expect(qb.whereCalls).toEqual([{ sql: 'booking.customerId = :userId', params: { userId: 'cust-1' } }]);
      expect(result[0]).toMatchObject({ id: 'ap-1', customerName: 'Rahim' });
    });

    it('filters to the provider\'s own bookings', async () => {
      const qb = fakeQb([]);
      approvalRepo.createQueryBuilder.mockReturnValue(qb);
      await service.listApprovals(provider);
      expect(qb.whereCalls).toEqual([{ sql: 'providerService.providerId = :userId', params: { userId: 'prov-1' } }]);
    });

    it('gives admins every approval', async () => {
      const qb = fakeQb([]);
      approvalRepo.createQueryBuilder.mockReturnValue(qb);
      await service.listApprovals(admin);
      expect(qb.whereCalls).toEqual([]);
    });
  });

  describe('listMessages', () => {
    const stored = [{ id: 'm-1', bookingId: 'bk-1', senderId: 'cust-1', senderType: 'customer', message: 'hi', createdAt: new Date() }];

    it('returns a booking\'s conversation to its customer and provider', async () => {
      messageRepo.find.mockResolvedValue(stored);
      expect(await service.listMessages(customer, 'bk-1')).toHaveLength(1);
      expect(await service.listMessages(provider, 'bk-1')).toHaveLength(1);
      expect(messageRepo.find).toHaveBeenCalledWith({ where: { bookingId: 'bk-1' }, order: { createdAt: 'ASC' } });
    });

    it('lets an admin read a conversation', async () => {
      messageRepo.find.mockResolvedValue(stored);
      expect(await service.listMessages(admin, 'bk-1')).toHaveLength(1);
    });

    it('hides a conversation from anyone else', async () => {
      await expect(service.listMessages(otherCustomer, 'bk-1')).rejects.toThrow(ForbiddenException);
      await expect(service.listMessages(otherProvider, 'bk-1')).rejects.toThrow(ForbiddenException);
    });

    it('without a booking, returns messages across the caller\'s own bookings', async () => {
      const qb = fakeQb(stored);
      messageRepo.createQueryBuilder.mockReturnValue(qb);

      expect(await service.listMessages(provider)).toHaveLength(1);
      expect(qb.whereCalls).toEqual([{ sql: 'providerService.providerId = :userId', params: { userId: 'prov-1' } }]);
    });

    it('makes admins name a booking', async () => {
      await expect(service.listMessages(admin)).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendMessage', () => {
    const approved = { id: 'ap-1', bookingId: 'bk-1', status: ChatApprovalStatus.APPROVED };

    it('saves a message once chat is approved, with the role from the login', async () => {
      approvalRepo.findOne.mockResolvedValue(approved);

      const result = await service.sendMessage(provider, { bookingId: 'bk-1', message: '  On my way  ' });

      expect(result).toMatchObject({ bookingId: 'bk-1', senderId: 'prov-1', senderType: 'provider', message: 'On my way' });
    });

    it('refuses before an admin approves', async () => {
      approvalRepo.findOne.mockResolvedValue({ ...approved, status: ChatApprovalStatus.PENDING });
      await expect(service.sendMessage(customer, { bookingId: 'bk-1', message: 'hi' })).rejects.toThrow(ForbiddenException);

      approvalRepo.findOne.mockResolvedValue(null);
      await expect(service.sendMessage(customer, { bookingId: 'bk-1', message: 'hi' })).rejects.toThrow(ForbiddenException);
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it('refuses after an admin rejects an open chat', async () => {
      approvalRepo.findOne.mockResolvedValue({ ...approved, status: ChatApprovalStatus.REJECTED });
      await expect(service.sendMessage(customer, { bookingId: 'bk-1', message: 'hi' })).rejects.toThrow(ForbiddenException);
    });

    it('refuses someone who is not on the booking, admins included', async () => {
      approvalRepo.findOne.mockResolvedValue(approved);
      await expect(service.sendMessage(otherCustomer, { bookingId: 'bk-1', message: 'hi' })).rejects.toThrow(ForbiddenException);
      await expect(service.sendMessage(admin, { bookingId: 'bk-1', message: 'hi' })).rejects.toThrow(ForbiddenException);
    });

    it('refuses on a cancelled booking', async () => {
      bookingRepo.findOne.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));
      approvalRepo.findOne.mockResolvedValue(approved);
      await expect(service.sendMessage(customer, { bookingId: 'bk-1', message: 'hi' })).rejects.toThrow(BadRequestException);
    });

    it('refuses a blank message', async () => {
      approvalRepo.findOne.mockResolvedValue(approved);
      await expect(service.sendMessage(customer, { bookingId: 'bk-1', message: '   ' })).rejects.toThrow(BadRequestException);
    });
  });
});
