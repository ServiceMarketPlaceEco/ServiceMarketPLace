// Unit tests for SupportService: chat between the admin team and one
// customer or provider. The rules: a customer or provider only ever sees
// their own conversation, admins share one inbox and can write to anyone,
// unread counts only count the other side's messages, and each side is told
// by email when the other writes.
// Run with: npm test

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupportService } from './support.service';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

const customer: CurrentUserData = { userId: 'cust-1', email: 'c@x.com', userType: 'customer', user: { name: 'Nusrat Jahan' } };
const provider: CurrentUserData = { userId: 'prov-1', email: 'p@x.com', userType: 'provider', user: { providerName: 'Karim Uddin' } };
const admin: CurrentUserData = { userId: 'admin-1', email: 'a@x.com', userType: 'admin', user: { name: 'Rahima' } };

function countQuery(count: number) {
  const qb: any = { where: jest.fn(() => qb), andWhere: jest.fn(() => qb), getCount: jest.fn(async () => count) };
  return qb;
}

describe('SupportService', () => {
  let service: SupportService;
  let threads: any;
  let messages: any;
  let customers: any;
  let providers: any;
  let mail: any;
  let notifier: any;

  const thread = (overrides: any = {}) => ({
    id: 'thread-1',
    userType: 'customer',
    userId: 'cust-1',
    userReadAt: null,
    adminReadAt: null,
    lastMessageAt: new Date('2026-11-12T01:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    threads = {
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ ...x, id: 'thread-1' })),
      update: jest.fn(async () => undefined),
    };
    messages = {
      find: jest.fn(async () => []),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ ...x, id: 'msg-1', createdAt: new Date('2026-11-12T02:00:00Z') })),
      createQueryBuilder: jest.fn(() => countQuery(0)),
    };
    customers = { findOne: jest.fn(), find: jest.fn(async () => []) };
    providers = { findOne: jest.fn(), find: jest.fn(async () => []) };
    mail = { sendSupportMessageNotification: jest.fn() };
    notifier = { notify: jest.fn() };
    service = new SupportService(threads, messages, customers, providers, mail, notifier);
  });

  describe('a customer or provider writing to the admin team', () => {
    it('creates the conversation on the first message and saves it under their name', async () => {
      const saved = await service.sendAsUser(customer, '  Can I change my booking time?  ');

      expect(threads.save).toHaveBeenCalledWith({ userType: 'customer', userId: 'cust-1' });
      expect(saved).toMatchObject({ senderType: 'customer', senderName: 'Nusrat Jahan', message: 'Can I change my booking time?' });
      expect(threads.update).toHaveBeenCalledWith('thread-1', { lastMessageAt: saved.createdAt, userReadAt: saved.createdAt });
    });

    it('reuses the conversation that already exists', async () => {
      threads.findOne.mockResolvedValue(thread());

      await service.sendAsUser(customer, 'Hello again');

      expect(threads.save).not.toHaveBeenCalled();
    });

    it('survives two first messages arriving at the same moment', async () => {
      threads.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(thread());
      threads.save.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

      await expect(service.sendAsUser(customer, 'Hello')).resolves.toMatchObject({ message: 'Hello' });
    });

    it('emails the admin team about the new message', async () => {
      await service.sendAsUser(provider, 'Can I add a new area?');

      expect(notifier.notify).toHaveBeenCalledWith(
        'New message from Karim Uddin',
        'Karim Uddin (provider) sent the admin team a message:',
        'Can I add a new area?',
      );
    });

    it('refuses an empty message', async () => {
      await expect(service.sendAsUser(customer, '   ')).rejects.toThrow(BadRequestException);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it('only ever looks up their own conversation', async () => {
      await service.getMyMessages(provider);

      expect(threads.findOne).toHaveBeenCalledWith({ where: { userType: 'provider', userId: 'prov-1' } });
    });

    it('returns nothing before any message exists, without creating a conversation', async () => {
      expect(await service.getMyMessages(customer)).toEqual([]);
      expect(threads.save).not.toHaveBeenCalled();
    });

    it('marks the conversation read when they open it, and returns it oldest first', async () => {
      threads.findOne.mockResolvedValue(thread());
      messages.find.mockResolvedValue([{ id: 'b' }, { id: 'a' }]);

      const result = await service.getMyMessages(customer);

      expect(result.map((m) => m.id)).toEqual(['a', 'b']);
      expect(threads.update).toHaveBeenCalledWith('thread-1', { userReadAt: expect.any(Date) });
    });

    it('counts unread admin messages since they last opened it', async () => {
      threads.findOne.mockResolvedValue(thread({ userReadAt: new Date('2026-11-12T00:00:00Z') }));
      const qb = countQuery(2);
      messages.createQueryBuilder.mockReturnValue(qb);

      expect(await service.unreadForUser(customer)).toBe(2);
      expect(qb.andWhere).toHaveBeenCalledWith("m.sender_type = 'admin'");
      expect(qb.andWhere).toHaveBeenCalledWith('m.created_at > :readAt', { readAt: new Date('2026-11-12T00:00:00Z') });
    });

    it('does not let an admin use the customer side', async () => {
      await expect(service.getMyMessages(admin)).rejects.toThrow(ForbiddenException);
      await expect(service.sendAsUser(admin, 'hi')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('the admin inbox', () => {
    it('lists conversations with the name, last message and unread count', async () => {
      threads.find.mockResolvedValue([thread(), thread({ id: 'thread-2', userType: 'provider', userId: 'prov-1' })]);
      customers.find.mockResolvedValue([{ customerId: 'cust-1', name: 'Nusrat Jahan' }]);
      providers.find.mockResolvedValue([{ providerId: 'prov-1', providerName: 'Karim Uddin' }]);
      messages.find.mockResolvedValue([{ message: 'Hello', senderType: 'customer', createdAt: new Date() }]);
      messages.createQueryBuilder.mockReturnValueOnce(countQuery(3)).mockReturnValueOnce(countQuery(0));

      const list = await service.listThreads();

      expect(list.map((t) => [t.userName, t.userType, t.unread])).toEqual([
        ['Nusrat Jahan', 'customer', 3],
        ['Karim Uddin', 'provider', 0],
      ]);
      expect(list[0].lastMessage?.message).toBe('Hello');
    });

    it('only counts messages that are not from an admin as unread', async () => {
      threads.find.mockResolvedValue([thread()]);
      const qb = countQuery(1);
      messages.createQueryBuilder.mockReturnValue(qb);

      expect(await service.unreadForAdmins()).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledWith("m.sender_type != 'admin'");
    });

    it('shows a closed account as Deleted account instead of failing', async () => {
      threads.find.mockResolvedValue([thread()]);
      messages.find.mockResolvedValue([]);

      const [row] = await service.listThreads();

      expect(row.userName).toBe('Deleted account');
    });

    it('lets an admin start a conversation with a provider and emails them', async () => {
      providers.findOne.mockResolvedValue({ providerId: 'prov-1', providerName: 'Karim Uddin', email: 'karim@x.com' });

      const saved = await service.sendAsAdmin(admin, 'provider', 'prov-1', 'Your documents are approved.');

      expect(saved).toMatchObject({ senderType: 'admin', senderName: 'Rahima' });
      expect(threads.update).toHaveBeenCalledWith('thread-1', { lastMessageAt: saved.createdAt, adminReadAt: saved.createdAt });
      expect(mail.sendSupportMessageNotification).toHaveBeenCalledWith('karim@x.com', 'Karim Uddin', 'Your documents are approved.');
    });

    it('still sends the message when the email fails', async () => {
      customers.findOne.mockResolvedValue({ customerId: 'cust-1', name: 'Nusrat', email: 'n@x.com' });
      mail.sendSupportMessageNotification.mockRejectedValue(new Error('smtp down'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(service.sendAsAdmin(admin, 'customer', 'cust-1', 'Hello')).resolves.toMatchObject({ message: 'Hello' });
    });

    it('returns 404 for an account that does not exist', async () => {
      customers.findOne.mockResolvedValue(null);

      await expect(service.sendAsAdmin(admin, 'customer', 'ghost', 'Hello')).rejects.toThrow(NotFoundException);
      await expect(service.getMessagesAsAdmin('customer', 'ghost')).rejects.toThrow(NotFoundException);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it('marks a conversation read for the admin team when one of them opens it', async () => {
      customers.findOne.mockResolvedValue({ customerId: 'cust-1' });
      threads.findOne.mockResolvedValue(thread());

      await service.getMessagesAsAdmin('customer', 'cust-1');

      expect(threads.update).toHaveBeenCalledWith('thread-1', { adminReadAt: expect.any(Date) });
    });
  });
});
