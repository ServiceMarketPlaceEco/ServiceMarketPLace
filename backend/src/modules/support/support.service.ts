import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { SupportThread, SupportUserType } from './entities/support-thread.entity';
import { SupportMessage, SupportSenderType } from './entities/support-message.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { MailService } from '../mail/mail.service';
import { AdminNotifierService } from '../mail/admin-notifier.service';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

export interface SupportMessageView {
  id: string;
  senderType: SupportSenderType;
  senderName: string;
  message: string;
  createdAt: Date;
}

// one row of the admin inbox
export interface SupportThreadView {
  userType: SupportUserType;
  userId: string;
  userName: string;
  lastMessage: { message: string; senderType: SupportSenderType; createdAt: Date } | null;
  lastMessageAt: Date | null;
  unread: number;
}

const ADMIN_INBOX_LIMIT = 200;
const THREAD_MESSAGE_LIMIT = 500;

// Chat between the admin team and one customer or provider. The client asked
// for provider <-> admin and admin <-> customer chat as well as the booking
// chat, so this is a second, separate kind of conversation: no booking and no
// approval step, because one side is always an admin.
@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportThread)
    private threadRepository: Repository<SupportThread>,
    @InjectRepository(SupportMessage)
    private messageRepository: Repository<SupportMessage>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
    private mailService: MailService,
    private adminNotifier: AdminNotifierService,
  ) {}

  // ---------- customer or provider ----------

  // my conversation with the admin team. opening it counts as reading it
  async getMyMessages(user: CurrentUserData): Promise<SupportMessageView[]> {
    const userType = this.asSupportUser(user);
    const thread = await this.findThread(userType, user.userId);
    if (!thread) return [];
    await this.threadRepository.update(thread.id, { userReadAt: new Date() });
    return this.messagesOf(thread.id);
  }

  async sendAsUser(user: CurrentUserData, text: string): Promise<SupportMessageView> {
    const userType = this.asSupportUser(user);
    const thread = await this.getOrCreateThread(userType, user.userId);
    const name = this.nameOf(user);
    const saved = await this.saveMessage(thread, userType, user.userId, name, text, 'userReadAt');

    // tell the admin team, so nobody has to keep the inbox open
    await this.adminNotifier.notify(
      `New message from ${name}`,
      `${name} (${userType}) sent the admin team a message:`,
      saved.message,
    );
    return saved;
  }

  // how many admin messages I haven't read (the badge on the dashboard)
  async unreadForUser(user: CurrentUserData): Promise<number> {
    const userType = this.asSupportUser(user);
    const thread = await this.findThread(userType, user.userId);
    if (!thread) return 0;
    return this.countUnread(thread, 'admin');
  }

  // ---------- admin ----------

  // every conversation that has messages, newest first
  async listThreads(): Promise<SupportThreadView[]> {
    const threads = await this.threadRepository.find({
      where: { lastMessageAt: Not(IsNull()) },
      order: { lastMessageAt: 'DESC' },
      take: ADMIN_INBOX_LIMIT,
    });
    if (threads.length === 0) return [];

    const names = await this.namesFor(threads);
    const views: SupportThreadView[] = [];
    for (const thread of threads) {
      const [last] = await this.messageRepository.find({
        where: { threadId: thread.id },
        order: { createdAt: 'DESC' },
        take: 1,
      });
      views.push({
        userType: thread.userType,
        userId: thread.userId,
        userName: names.get(`${thread.userType}:${thread.userId}`) || 'Deleted account',
        lastMessage: last ? { message: last.message, senderType: last.senderType, createdAt: last.createdAt } : null,
        lastMessageAt: thread.lastMessageAt,
        unread: await this.countUnread(thread, 'user'),
      });
    }
    return views;
  }

  async unreadForAdmins(): Promise<number> {
    const threads = await this.threadRepository.find({ where: { lastMessageAt: Not(IsNull()) } });
    let total = 0;
    for (const thread of threads) total += await this.countUnread(thread, 'user');
    return total;
  }

  // an admin opens the conversation with one customer or provider. works
  // before any message exists, so an admin can start the conversation
  async getMessagesAsAdmin(userType: SupportUserType, userId: string): Promise<SupportMessageView[]> {
    await this.assertAccountExists(userType, userId);
    const thread = await this.findThread(userType, userId);
    if (!thread) return [];
    await this.threadRepository.update(thread.id, { adminReadAt: new Date() });
    return this.messagesOf(thread.id);
  }

  async sendAsAdmin(
    admin: CurrentUserData,
    userType: SupportUserType,
    userId: string,
    text: string,
  ): Promise<SupportMessageView> {
    const account = await this.assertAccountExists(userType, userId);
    const thread = await this.getOrCreateThread(userType, userId);
    const saved = await this.saveMessage(
      thread,
      'admin',
      admin.userId,
      admin.user?.name || 'ServiceHub admin',
      text,
      'adminReadAt',
    );

    // email the customer or provider that the admin team wrote to them
    try {
      await this.mailService.sendSupportMessageNotification(
        account.email,
        userType === 'customer' ? (account as Customer).name : (account as ServiceProvider).providerName,
        saved.message,
      );
    } catch (error) {
      console.error('Failed to send support message email:', error);
    }
    return saved;
  }

  // ---------- helpers ----------

  private asSupportUser(user: CurrentUserData): SupportUserType {
    if (user.userType === 'customer' || user.userType === 'provider') return user.userType;
    throw new ForbiddenException('Admins use the admin inbox');
  }

  private nameOf(user: CurrentUserData): string {
    if (user.userType === 'provider') return user.user?.providerName || 'Provider';
    return user.user?.name || 'Customer';
  }

  private findThread(userType: SupportUserType, userId: string): Promise<SupportThread | null> {
    return this.threadRepository.findOne({ where: { userType, userId } });
  }

  private async getOrCreateThread(userType: SupportUserType, userId: string): Promise<SupportThread> {
    const existing = await this.findThread(userType, userId);
    if (existing) return existing;
    try {
      return await this.threadRepository.save(this.threadRepository.create({ userType, userId }));
    } catch (error: any) {
      // two first messages at the same moment: the unique index refuses the
      // second insert, which just means the thread now exists
      if (error?.code !== 'ER_DUP_ENTRY') throw error;
      const created = await this.findThread(userType, userId);
      if (!created) throw error;
      return created;
    }
  }

  private async saveMessage(
    thread: SupportThread,
    senderType: SupportSenderType,
    senderId: string,
    senderName: string,
    text: string,
    readField: 'userReadAt' | 'adminReadAt',
  ): Promise<SupportMessageView> {
    const message = (text ?? '').trim();
    if (!message) throw new BadRequestException('Message cannot be empty');

    const saved = await this.messageRepository.save(
      this.messageRepository.create({ threadId: thread.id, senderType, senderId, senderName, message }),
    );
    // sending also means you've read everything before it
    await this.threadRepository.update(thread.id, { lastMessageAt: saved.createdAt, [readField]: saved.createdAt });
    return this.toView(saved);
  }

  private async messagesOf(threadId: string): Promise<SupportMessageView[]> {
    const messages = await this.messageRepository.find({
      where: { threadId },
      order: { createdAt: 'DESC' },
      take: THREAD_MESSAGE_LIMIT,
    });
    return messages.reverse().map((m) => this.toView(m));
  }

  // messages from the other side that arrived after this side last opened it
  private async countUnread(thread: SupportThread, from: 'admin' | 'user'): Promise<number> {
    const readAt = from === 'admin' ? thread.userReadAt : thread.adminReadAt;
    const qb = this.messageRepository
      .createQueryBuilder('m')
      .where('m.thread_id = :threadId', { threadId: thread.id })
      .andWhere(from === 'admin' ? "m.sender_type = 'admin'" : "m.sender_type != 'admin'");
    if (readAt) qb.andWhere('m.created_at > :readAt', { readAt });
    return qb.getCount();
  }

  private async namesFor(threads: SupportThread[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const customerIds = threads.filter((t) => t.userType === 'customer').map((t) => t.userId);
    const providerIds = threads.filter((t) => t.userType === 'provider').map((t) => t.userId);
    if (customerIds.length) {
      const customers = await this.customerRepository.find({
        where: { customerId: In(customerIds) },
        select: { customerId: true, name: true },
      });
      customers.forEach((c) => names.set(`customer:${c.customerId}`, c.name));
    }
    if (providerIds.length) {
      const providers = await this.providerRepository.find({
        where: { providerId: In(providerIds) },
        select: { providerId: true, providerName: true },
      });
      providers.forEach((p) => names.set(`provider:${p.providerId}`, p.providerName));
    }
    return names;
  }

  private async assertAccountExists(userType: SupportUserType, userId: string): Promise<Customer | ServiceProvider> {
    const account =
      userType === 'customer'
        ? await this.customerRepository.findOne({ where: { customerId: userId } })
        : await this.providerRepository.findOne({ where: { providerId: userId } });
    if (!account) throw new NotFoundException(`That ${userType} account was not found`);
    return account;
  }

  private toView(message: SupportMessage): SupportMessageView {
    return {
      id: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      message: message.message,
      createdAt: message.createdAt,
    };
  }
}
