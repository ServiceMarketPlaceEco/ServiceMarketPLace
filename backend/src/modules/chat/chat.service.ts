import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { ChatConversation, ConversationType } from './entities/chat-conversation.entity';
import { ChatMessage, ChatSender } from './entities/chat-message.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

// what the chat list shows for each conversation, worded for whoever asks
export interface ConversationSummary {
  conversationId: string;
  type: ConversationType;
  title: string;
  subtitle: string;
  bookingId: string | null;
  customerId: string | null;
  providerId: string | null;
  lastMessage: { body: string; senderType: ChatSender; senderName: string; createdAt: Date } | null;
  lastMessageAt: Date | null;
  unread: number;
}

// how many messages the first open of a chat loads. later refreshes only
// fetch what is newer than the last message the screen already has
const FIRST_LOAD_LIMIT = 200;
// admins see the chats that have messages, newest first
const ADMIN_LIST_LIMIT = 200;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatConversation)
    private conversationRepository: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private messageRepository: Repository<ChatMessage>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
  ) {}

  // ---------- list ----------

  async listConversations(user: CurrentUserData): Promise<ConversationSummary[]> {
    let conversations: ChatConversation[];

    if (user.userType === 'customer') {
      await this.openBookingChats({ customerId: user.userId });
      await this.getOrCreateSupport('customer', user.userId);
      conversations = await this.conversationRepository.find({
        where: [
          { customerId: user.userId, type: ConversationType.BOOKING },
          { customerId: user.userId, type: ConversationType.CUSTOMER_SUPPORT },
        ],
        relations: ['customer', 'provider', 'booking'],
      });
    } else if (user.userType === 'provider') {
      await this.openBookingChats({ providerId: user.userId });
      await this.getOrCreateSupport('provider', user.userId);
      conversations = await this.conversationRepository.find({
        where: [
          { providerId: user.userId, type: ConversationType.BOOKING },
          { providerId: user.userId, type: ConversationType.PROVIDER_SUPPORT },
        ],
        relations: ['customer', 'provider', 'booking'],
      });
    } else {
      // admins don't need an empty chat for every user, just the ones with
      // messages. they start a new one from the user picker instead
      conversations = await this.conversationRepository.find({
        where: { lastMessageAt: Not(IsNull()) },
        relations: ['customer', 'provider', 'booking'],
        order: { lastMessageAt: 'DESC' },
        take: ADMIN_LIST_LIMIT,
      });
    }

    const summaries = await this.summarise(conversations, user);
    // newest activity first, empty chats after them
    return summaries.sort((a, b) => this.timeOf(b) - this.timeOf(a));
  }

  private timeOf(summary: ConversationSummary): number {
    return summary.lastMessageAt ? new Date(summary.lastMessageAt).getTime() : 0;
  }

  // makes sure every booking that has a provider assigned (by the admin) has
  // its customer <-> provider chat. pending bookings don't get one yet.
  private async openBookingChats(who: { customerId?: string; providerId?: string }): Promise<void> {
    const qb = this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoin('booking.providerService', 'ps')
      .select(['booking.bookingId AS bookingId', 'booking.customerId AS customerId', 'ps.providerId AS providerId'])
      .where('booking.status != :pending', { pending: BookingStatus.PENDING });

    if (who.customerId) qb.andWhere('booking.customerId = :customerId', { customerId: who.customerId });
    if (who.providerId) qb.andWhere('ps.providerId = :providerId', { providerId: who.providerId });

    const rows: { bookingId: string; customerId: string; providerId: string }[] = await qb.getRawMany();
    if (rows.length === 0) return;

    const existing = await this.conversationRepository.find({
      where: { chatKey: In(rows.map((row) => `booking:${row.bookingId}`)) },
    });
    const byKey = new Map(existing.map((c) => [c.chatKey, c]));

    for (const row of rows) {
      const key = `booking:${row.bookingId}`;
      const found = byKey.get(key);
      if (!found) {
        await this.insertIgnoringDuplicate({
          type: ConversationType.BOOKING,
          chatKey: key,
          bookingId: row.bookingId,
          customerId: row.customerId,
          providerId: row.providerId,
        });
      } else if (found.providerId !== row.providerId) {
        // the admin gave the job to a different provider, so the chat moves
        // to the new one and the old provider can no longer see it
        await this.conversationRepository.update(found.conversationId, { providerId: row.providerId });
      }
    }
  }

  private async getOrCreateSupport(userType: 'customer' | 'provider', userId: string): Promise<ChatConversation> {
    const key = `${userType}:${userId}`;
    const existing = await this.conversationRepository.findOne({ where: { chatKey: key } });
    if (existing) return existing;

    await this.insertIgnoringDuplicate({
      type: userType === 'customer' ? ConversationType.CUSTOMER_SUPPORT : ConversationType.PROVIDER_SUPPORT,
      chatKey: key,
      customerId: userType === 'customer' ? userId : null,
      providerId: userType === 'provider' ? userId : null,
      bookingId: null,
    });
    return this.conversationRepository.findOneOrFail({ where: { chatKey: key } });
  }

  // two refreshes can race to create the same chat. chat_key is unique, so
  // the second insert fails with a duplicate error, which just means it exists
  private async insertIgnoringDuplicate(values: Partial<ChatConversation>): Promise<void> {
    try {
      await this.conversationRepository.insert(values);
    } catch (error: any) {
      if (error?.code !== 'ER_DUP_ENTRY') throw error;
    }
  }

  private async summarise(conversations: ChatConversation[], user: CurrentUserData): Promise<ConversationSummary[]> {
    if (conversations.length === 0) return [];
    const ids = conversations.map((c) => c.conversationId);
    const me = this.senderFor(user);
    const readColumn = this.readColumnFor(user);

    // the newest message of each chat
    const latest: ChatMessage[] = await this.messageRepository
      .createQueryBuilder('m')
      .where('m.conversationId IN (:...ids)', { ids })
      .andWhere(
        'm.createdAt = (SELECT MAX(m2.created_at) FROM chat_messages m2 WHERE m2.conversation_id = m.conversation_id)',
      )
      .getMany();
    const latestByChat = new Map(latest.map((m) => [m.conversationId, m]));

    // messages from the other side that arrived after I last opened the chat
    const unreadRows: { id: string; count: string }[] = await this.messageRepository
      .createQueryBuilder('m')
      .innerJoin(ChatConversation, 'c', 'c.conversation_id = m.conversation_id')
      .select('m.conversation_id', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('m.conversation_id IN (:...ids)', { ids })
      .andWhere('m.sender_type != :me', { me })
      .andWhere(`(c.${readColumn} IS NULL OR m.created_at > c.${readColumn})`)
      .groupBy('m.conversation_id')
      .getRawMany();
    const unreadByChat = new Map(unreadRows.map((row) => [row.id, Number(row.count)]));

    return conversations.map((c) => {
      const last = latestByChat.get(c.conversationId);
      return {
        conversationId: c.conversationId,
        type: c.type,
        ...this.describe(c, user),
        bookingId: c.bookingId,
        customerId: c.customerId,
        providerId: c.providerId,
        lastMessage: last
          ? { body: last.body, senderType: last.senderType, senderName: last.senderName, createdAt: last.createdAt }
          : null,
        lastMessageAt: last?.createdAt ?? c.lastMessageAt ?? null,
        unread: unreadByChat.get(c.conversationId) ?? 0,
      };
    });
  }

  // the name at the top of a chat depends on who is looking at it
  private describe(c: ChatConversation, user: CurrentUserData): { title: string; subtitle: string } {
    const customerName = c.customer?.name || 'Customer';
    const providerName = c.provider?.providerName || 'Provider';
    const service = c.booking?.serviceName || 'Booking';
    const when = c.booking?.date ? ` on ${String(c.booking.date).slice(0, 10)}` : '';

    if (c.type === ConversationType.CUSTOMER_SUPPORT) {
      return user.userType === 'admin'
        ? { title: customerName, subtitle: 'Customer' }
        : { title: 'ServiceHub admin', subtitle: 'Questions about bookings or your account' };
    }
    if (c.type === ConversationType.PROVIDER_SUPPORT) {
      return user.userType === 'admin'
        ? { title: providerName, subtitle: 'Provider' }
        : { title: 'ServiceHub admin', subtitle: 'Questions about jobs or your account' };
    }
    if (user.userType === 'customer') return { title: providerName, subtitle: `${service}${when}` };
    if (user.userType === 'provider') return { title: customerName, subtitle: `${service}${when}` };
    return { title: `${customerName} and ${providerName}`, subtitle: `${service}${when}` };
  }

  // ---------- one chat ----------

  async getMessages(user: CurrentUserData, conversationId: string, after?: string): Promise<ChatMessage[]> {
    const conversation = await this.findAllowed(user, conversationId);

    let messages: ChatMessage[];
    if (after) {
      messages = await this.messageRepository.find({
        where: { conversationId, createdAt: MoreThan(new Date(after)) },
        order: { createdAt: 'ASC' },
        take: FIRST_LOAD_LIMIT,
      });
    } else {
      messages = (
        await this.messageRepository.find({
          where: { conversationId },
          order: { createdAt: 'DESC' },
          take: FIRST_LOAD_LIMIT,
        })
      ).reverse();
    }

    // opening the chat counts as reading it
    await this.conversationRepository.update(conversation.conversationId, {
      [this.readFieldFor(user)]: new Date(),
    });

    return messages;
  }

  async sendMessage(user: CurrentUserData, conversationId: string, body: string): Promise<ChatMessage> {
    const conversation = await this.findAllowed(user, conversationId);
    const text = (body || '').trim();
    if (!text) throw new BadRequestException('Type a message first');

    const message = await this.messageRepository.save(
      this.messageRepository.create({
        conversationId: conversation.conversationId,
        senderType: this.senderFor(user),
        senderId: user.userId,
        senderName: this.nameOf(user),
        body: text,
      }),
    );

    // sending also means you've read everything before it
    await this.conversationRepository.update(conversation.conversationId, {
      lastMessageAt: message.createdAt,
      [this.readFieldFor(user)]: message.createdAt,
    });

    return message;
  }

  // admin starting (or reopening) a support chat with a customer or provider
  async startSupportChat(user: CurrentUserData, userType: 'customer' | 'provider', userId: string) {
    const exists =
      userType === 'customer'
        ? await this.customerRepository.findOne({ where: { customerId: userId } })
        : await this.providerRepository.findOne({ where: { providerId: userId } });
    if (!exists) throw new NotFoundException(`That ${userType} account was not found`);

    const conversation = await this.getOrCreateSupport(userType, userId);
    const full = await this.conversationRepository.findOneOrFail({
      where: { conversationId: conversation.conversationId },
      relations: ['customer', 'provider', 'booking'],
    });
    const [summary] = await this.summarise([full], user);
    return summary;
  }

  // a chat you aren't part of looks the same as one that doesn't exist, so
  // nobody can find out which chats are there by guessing ids
  private async findAllowed(user: CurrentUserData, conversationId: string): Promise<ChatConversation> {
    const conversation = await this.conversationRepository.findOne({ where: { conversationId } });
    if (!conversation || !this.canAccess(user, conversation)) {
      throw new NotFoundException('Chat not found');
    }
    return conversation;
  }

  canAccess(user: CurrentUserData, c: ChatConversation): boolean {
    if (user.userType === 'admin') return true;
    if (user.userType === 'customer') {
      return c.customerId === user.userId && c.type !== ConversationType.PROVIDER_SUPPORT;
    }
    if (user.userType === 'provider') {
      return c.providerId === user.userId && c.type !== ConversationType.CUSTOMER_SUPPORT;
    }
    return false;
  }

  private senderFor(user: CurrentUserData): ChatSender {
    if (user.userType === 'customer') return ChatSender.CUSTOMER;
    if (user.userType === 'provider') return ChatSender.PROVIDER;
    return ChatSender.ADMIN;
  }

  private nameOf(user: CurrentUserData): string {
    if (user.userType === 'provider') return user.user?.providerName || 'Provider';
    if (user.userType === 'admin') return user.user?.name || 'Admin';
    return user.user?.name || 'Customer';
  }

  private readFieldFor(user: CurrentUserData): 'customerReadAt' | 'providerReadAt' | 'adminReadAt' {
    if (user.userType === 'customer') return 'customerReadAt';
    if (user.userType === 'provider') return 'providerReadAt';
    return 'adminReadAt';
  }

  private readColumnFor(user: CurrentUserData): string {
    if (user.userType === 'customer') return 'customer_read_at';
    if (user.userType === 'provider') return 'provider_read_at';
    return 'admin_read_at';
  }
}
