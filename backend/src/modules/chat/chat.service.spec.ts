// Unit tests for ChatService.
// The rules: a customer and provider can only chat about a booking once an
// admin has assigned the provider, each person only sees their own chats,
// admins can see and answer all of them, and unread counts only count
// messages from the other side.
// Run with: npm test

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ConversationType } from './entities/chat-conversation.entity';
import { ChatSender } from './entities/chat-message.entity';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

const customer: CurrentUserData = {
  userId: 'cust-1',
  email: 'c@x.com',
  userType: 'customer',
  user: { name: 'Nusrat Jahan' },
};
const otherCustomer: CurrentUserData = { ...customer, userId: 'cust-2', user: { name: 'Someone Else' } };
const provider: CurrentUserData = {
  userId: 'prov-1',
  email: 'p@x.com',
  userType: 'provider',
  user: { providerName: 'Karim Uddin' },
};
const admin: CurrentUserData = { userId: 'admin-1', email: 'a@x.com', userType: 'admin', user: { name: 'Admin' } };

// a query builder whose chain methods all return itself
function queryBuilder(result: { many?: any[]; raw?: any[] }) {
  const qb: any = {};
  for (const name of ['select', 'addSelect', 'where', 'andWhere', 'innerJoin', 'groupBy']) {
    qb[name] = jest.fn(() => qb);
  }
  qb.getMany = jest.fn(async () => result.many ?? []);
  qb.getRawMany = jest.fn(async () => result.raw ?? []);
  return qb;
}

const bookingChat = (overrides: any = {}) => ({
  conversationId: 'conv-1',
  type: ConversationType.BOOKING,
  chatKey: 'booking:b-1',
  customerId: 'cust-1',
  providerId: 'prov-1',
  bookingId: 'b-1',
  customer: { name: 'Nusrat Jahan' },
  provider: { providerName: 'Karim Uddin' },
  booking: { serviceName: 'Plumbing', date: '2026-11-10' },
  lastMessageAt: null,
  ...overrides,
});

describe('ChatService', () => {
  let service: ChatService;
  let conversations: any;
  let messages: any;
  let bookings: any;
  let customers: any;
  let providers: any;
  let bookingRows: any[];

  beforeEach(() => {
    bookingRows = [];
    conversations = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      findOneOrFail: jest.fn(async () => ({ conversationId: 'conv-support', chatKey: 'customer:cust-1' })),
      insert: jest.fn(async () => undefined),
      update: jest.fn(async () => undefined),
    };
    messages = {
      find: jest.fn(async () => []),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ ...x, messageId: 'msg-1', createdAt: new Date('2026-11-06T02:00:00Z') })),
      createQueryBuilder: jest.fn(() => queryBuilder({})),
    };
    bookings = { createQueryBuilder: jest.fn(() => queryBuilder({ raw: bookingRows })) };
    customers = { findOne: jest.fn() };
    providers = { findOne: jest.fn() };
    service = new ChatService(conversations, messages, bookings, customers, providers);
  });

  describe('who can open which chat', () => {
    it('lets the customer and provider of a booking into its chat', () => {
      const chat: any = bookingChat();
      expect(service.canAccess(customer, chat)).toBe(true);
      expect(service.canAccess(provider, chat)).toBe(true);
    });

    it('keeps other customers and providers out', () => {
      const chat: any = bookingChat();
      expect(service.canAccess(otherCustomer, chat)).toBe(false);
      expect(service.canAccess({ ...provider, userId: 'prov-9' }, chat)).toBe(false);
    });

    it('lets admins into every chat', () => {
      expect(service.canAccess(admin, bookingChat() as any)).toBe(true);
      expect(service.canAccess(admin, { type: ConversationType.PROVIDER_SUPPORT, providerId: 'prov-1' } as any)).toBe(
        true,
      );
    });

    it('keeps a provider out of a customer support chat and the other way round', () => {
      const customerSupport: any = { type: ConversationType.CUSTOMER_SUPPORT, customerId: 'cust-1', providerId: null };
      const providerSupport: any = { type: ConversationType.PROVIDER_SUPPORT, customerId: null, providerId: 'prov-1' };
      expect(service.canAccess(provider, customerSupport)).toBe(false);
      expect(service.canAccess(customer, providerSupport)).toBe(false);
    });
  });

  describe('listConversations', () => {
    it('opens a chat for each assigned booking and a support chat for the customer', async () => {
      bookingRows.push({ bookingId: 'b-1', customerId: 'cust-1', providerId: 'prov-1' });

      await service.listConversations(customer);

      expect(conversations.insert).toHaveBeenCalledWith(
        expect.objectContaining({ type: ConversationType.BOOKING, chatKey: 'booking:b-1', providerId: 'prov-1' }),
      );
      expect(conversations.insert).toHaveBeenCalledWith(
        expect.objectContaining({ type: ConversationType.CUSTOMER_SUPPORT, chatKey: 'customer:cust-1' }),
      );
    });

    it('only opens booking chats once the booking is past pending', async () => {
      const qb = queryBuilder({ raw: [] });
      bookings.createQueryBuilder.mockReturnValue(qb);

      await service.listConversations(customer);

      expect(qb.where).toHaveBeenCalledWith('booking.status != :pending', { pending: 'pending' });
      expect(qb.innerJoin).toHaveBeenCalledWith('booking.providerService', 'ps');
    });

    it('moves the chat to the new provider when the admin reassigns the job', async () => {
      bookingRows.push({ bookingId: 'b-1', customerId: 'cust-1', providerId: 'prov-2' });
      conversations.find.mockResolvedValueOnce([bookingChat()]);

      await service.listConversations(customer);

      expect(conversations.update).toHaveBeenCalledWith('conv-1', { providerId: 'prov-2' });
    });

    it('treats a duplicate insert from two refreshes at once as fine', async () => {
      bookingRows.push({ bookingId: 'b-1', customerId: 'cust-1', providerId: 'prov-1' });
      conversations.insert.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

      await expect(service.listConversations(customer)).resolves.toBeDefined();
    });

    it('names each chat for the person looking at it', async () => {
      conversations.find.mockResolvedValue([bookingChat()]);

      const [forCustomer] = await service.listConversations(customer);
      const [forProvider] = await service.listConversations(provider);
      const [forAdmin] = await service.listConversations(admin);

      expect(forCustomer.title).toBe('Karim Uddin');
      expect(forProvider.title).toBe('Nusrat Jahan');
      expect(forAdmin.title).toBe('Nusrat Jahan and Karim Uddin');
      expect(forCustomer.subtitle).toBe('Plumbing on 2026-11-10');
    });

    it('only shows admins the chats that have messages', async () => {
      await service.listConversations(admin);

      const [options] = conversations.find.mock.calls[0];
      expect(options.where.lastMessageAt).toBeDefined();
      expect(conversations.insert).not.toHaveBeenCalled();
    });

    it('counts unread messages from the other side only', async () => {
      conversations.find.mockResolvedValue([bookingChat()]);
      const unreadQuery = queryBuilder({ raw: [{ id: 'conv-1', count: '3' }] });
      messages.createQueryBuilder.mockReturnValueOnce(queryBuilder({})).mockReturnValueOnce(unreadQuery);

      const [chat] = await service.listConversations(customer);

      expect(chat.unread).toBe(3);
      expect(unreadQuery.andWhere).toHaveBeenCalledWith('m.sender_type != :me', { me: ChatSender.CUSTOMER });
    });

    it('puts the chat with the newest message first', async () => {
      conversations.find.mockResolvedValue([
        bookingChat({ conversationId: 'old', lastMessageAt: new Date('2026-11-01') }),
        bookingChat({ conversationId: 'new', lastMessageAt: new Date('2026-11-05') }),
        bookingChat({ conversationId: 'empty', lastMessageAt: null }),
      ]);

      const list = await service.listConversations(customer);

      expect(list.map((c) => c.conversationId)).toEqual(['new', 'old', 'empty']);
    });
  });

  describe('sendMessage', () => {
    it('saves the message with the sender worked out from the login', async () => {
      conversations.findOne.mockResolvedValue(bookingChat());

      const message = await service.sendMessage(provider, 'conv-1', '  On my way  ');

      expect(message).toMatchObject({
        senderType: ChatSender.PROVIDER,
        senderId: 'prov-1',
        senderName: 'Karim Uddin',
        body: 'On my way',
      });
      expect(conversations.update).toHaveBeenCalledWith('conv-1', {
        lastMessageAt: message.createdAt,
        providerReadAt: message.createdAt,
      });
    });

    it('refuses a chat that is not yours, as if it did not exist', async () => {
      conversations.findOne.mockResolvedValue(bookingChat());

      await expect(service.sendMessage(otherCustomer, 'conv-1', 'hi')).rejects.toThrow(NotFoundException);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it('refuses an empty message', async () => {
      conversations.findOne.mockResolvedValue(bookingChat());

      await expect(service.sendMessage(customer, 'conv-1', '   ')).rejects.toThrow(BadRequestException);
    });

    it('lets an admin answer any chat', async () => {
      conversations.findOne.mockResolvedValue(bookingChat());

      const message = await service.sendMessage(admin, 'conv-1', 'I have checked the booking');

      expect(message.senderType).toBe(ChatSender.ADMIN);
      expect(message.senderName).toBe('Admin');
    });
  });

  describe('getMessages', () => {
    it('marks the chat as read for whoever opened it', async () => {
      conversations.findOne.mockResolvedValue(bookingChat());

      await service.getMessages(customer, 'conv-1');

      expect(conversations.update).toHaveBeenCalledWith('conv-1', { customerReadAt: expect.any(Date) });
    });

    it('only fetches newer messages on a refresh', async () => {
      conversations.findOne.mockResolvedValue(bookingChat());

      await service.getMessages(customer, 'conv-1', '2026-11-06T02:00:00.000Z');

      const [options] = messages.find.mock.calls[0];
      expect(options.order).toEqual({ createdAt: 'ASC' });
      expect(options.where.createdAt).toBeDefined();
    });

    it('returns the first load oldest first', async () => {
      conversations.findOne.mockResolvedValue(bookingChat());
      messages.find.mockResolvedValue([{ messageId: 'b' }, { messageId: 'a' }]);

      const result = await service.getMessages(customer, 'conv-1');

      expect(result.map((m) => m.messageId)).toEqual(['a', 'b']);
    });

    it('does not show someone else’s chat', async () => {
      conversations.findOne.mockResolvedValue(bookingChat());

      await expect(service.getMessages(otherCustomer, 'conv-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('startSupportChat', () => {
    it('opens a chat between the admin and a provider', async () => {
      providers.findOne.mockResolvedValue({ providerId: 'prov-1' });
      conversations.findOneOrFail.mockResolvedValue({
        conversationId: 'conv-9',
        type: ConversationType.PROVIDER_SUPPORT,
        chatKey: 'provider:prov-1',
        providerId: 'prov-1',
        provider: { providerName: 'Karim Uddin' },
      });

      const chat = await service.startSupportChat(admin, 'provider', 'prov-1');

      expect(conversations.insert).toHaveBeenCalledWith(
        expect.objectContaining({ type: ConversationType.PROVIDER_SUPPORT, chatKey: 'provider:prov-1' }),
      );
      expect(chat.title).toBe('Karim Uddin');
    });

    it('returns 404 for an account that does not exist', async () => {
      customers.findOne.mockResolvedValue(null);

      await expect(service.startSupportChat(admin, 'customer', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
