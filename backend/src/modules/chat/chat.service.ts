import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import {
  ChatApproval,
  ChatApprovalStatus,
  ChatParticipantType,
} from './entities/chat-approval.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { SendChatMessageDto } from './dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

// What the endpoints return. Built by hand instead of returning entities so
// related customer/provider rows (and their password hashes) never leak out.
export interface ChatApprovalView {
  id: string;
  bookingId: string;
  requestedBy: ChatParticipantType;
  status: ChatApprovalStatus;
  serviceName: string | null;
  customerName: string | null;
  providerName: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageView {
  id: string;
  bookingId: string;
  senderId: string;
  senderType: ChatParticipantType;
  message: string;
  createdAt: Date;
}

type ChatUser = Pick<CurrentUserData, 'userId' | 'userType'>;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatApproval)
    private approvalRepository: Repository<ChatApproval>,
    @InjectRepository(ChatMessage)
    private messageRepository: Repository<ChatMessage>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  // ---------- Approvals ----------

  // A customer or provider on a booking asks an admin to open chat on it.
  // Asking again while pending/approved just returns the existing approval;
  // asking again after a rejection puts it back in the admin's queue.
  async requestApproval(user: ChatUser, bookingId: string): Promise<ChatApprovalView> {
    const booking = await this.loadBooking(bookingId);
    const role = this.assertParticipant(booking, user);

    if (!booking.providerServiceId) {
      throw new BadRequestException('Chat opens once a provider is assigned to this booking');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Chat is not available on a cancelled booking');
    }

    const existing = await this.approvalRepository.findOne({ where: { bookingId } });
    if (existing && existing.status !== ChatApprovalStatus.REJECTED) {
      return this.toApprovalView(existing, booking);
    }

    const approval = existing ?? this.approvalRepository.create({ bookingId });
    approval.requestedBy = role;
    approval.requestedById = user.userId;
    approval.status = ChatApprovalStatus.PENDING;
    approval.reviewedBy = null;
    approval.reviewedAt = null;

    const saved = await this.approvalRepository.save(approval);
    return this.toApprovalView(saved, booking);
  }

  // Admin approves or rejects. Rejecting an approved chat closes it again:
  // the history stays readable but no new messages are accepted.
  async reviewApproval(
    adminId: string,
    approvalId: string,
    status: 'approved' | 'rejected',
  ): Promise<ChatApprovalView> {
    const approval = await this.approvalRepository.findOne({
      where: { id: approvalId },
      relations: ['booking', 'booking.customer', 'booking.providerService', 'booking.providerService.provider', 'booking.providerService.service'],
    });
    if (!approval) {
      throw new NotFoundException('Chat approval not found');
    }

    approval.status = status === 'approved' ? ChatApprovalStatus.APPROVED : ChatApprovalStatus.REJECTED;
    approval.reviewedBy = adminId;
    approval.reviewedAt = new Date();

    const saved = await this.approvalRepository.save(approval);
    return this.toApprovalView(saved, approval.booking);
  }

  // Admins see every approval; customers and providers see the ones on their
  // own bookings.
  async listApprovals(user: ChatUser): Promise<ChatApprovalView[]> {
    const qb = this.approvalRepository
      .createQueryBuilder('approval')
      .innerJoinAndSelect('approval.booking', 'booking')
      .leftJoinAndSelect('booking.customer', 'customer')
      .leftJoinAndSelect('booking.providerService', 'providerService')
      .leftJoinAndSelect('providerService.provider', 'provider')
      .leftJoinAndSelect('providerService.service', 'service');

    if (user.userType === 'customer') {
      qb.where('booking.customerId = :userId', { userId: user.userId });
    } else if (user.userType === 'provider') {
      qb.where('providerService.providerId = :userId', { userId: user.userId });
    } else if (user.userType !== 'admin') {
      return [];
    }

    const approvals = await qb.orderBy('approval.createdAt', 'DESC').getMany();
    return approvals.map((a) => this.toApprovalView(a, a.booking));
  }

  // ---------- Messages ----------

  // With a bookingId: that booking's conversation (participants, or an admin
  // looking into a dispute). Without: every message across the caller's own
  // bookings, so a dashboard can load all its conversations in one call.
  async listMessages(user: ChatUser, bookingId?: string): Promise<ChatMessageView[]> {
    if (bookingId) {
      const booking = await this.loadBooking(bookingId);
      if (user.userType !== 'admin') {
        this.assertParticipant(booking, user);
      }
      const messages = await this.messageRepository.find({
        where: { bookingId },
        order: { createdAt: 'ASC' },
      });
      return messages.map((m) => this.toMessageView(m));
    }

    if (user.userType === 'admin') {
      throw new BadRequestException('bookingId is required');
    }

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('message.booking', 'booking')
      .leftJoin('booking.providerService', 'providerService');

    if (user.userType === 'customer') {
      qb.where('booking.customerId = :userId', { userId: user.userId });
    } else if (user.userType === 'provider') {
      qb.where('providerService.providerId = :userId', { userId: user.userId });
    } else {
      return [];
    }

    const messages = await qb.orderBy('message.createdAt', 'ASC').getMany();
    return messages.map((m) => this.toMessageView(m));
  }

  async sendMessage(user: ChatUser, dto: SendChatMessageDto): Promise<ChatMessageView> {
    const booking = await this.loadBooking(dto.bookingId);
    // the sender's role comes from their token, never from the request body
    const role = this.assertParticipant(booking, user);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Chat is not available on a cancelled booking');
    }

    const approval = await this.approvalRepository.findOne({ where: { bookingId: dto.bookingId } });
    if (approval?.status !== ChatApprovalStatus.APPROVED) {
      throw new ForbiddenException('Chat on this booking has not been approved by an admin');
    }

    const text = (dto.message ?? '').trim();
    if (!text) {
      throw new BadRequestException('Message cannot be empty');
    }

    const saved = await this.messageRepository.save(
      this.messageRepository.create({
        bookingId: dto.bookingId,
        senderId: user.userId,
        senderType: role,
        message: text,
      }),
    );
    return this.toMessageView(saved);
  }

  // ---------- Helpers ----------

  private async loadBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { bookingId },
      relations: ['customer', 'providerService', 'providerService.provider', 'providerService.service'],
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  // Only the booking's own customer and its assigned provider take part in
  // its chat. Admins never send messages.
  private assertParticipant(booking: Booking, user: ChatUser): ChatParticipantType {
    if (user.userType === 'customer' && booking.customerId === user.userId) {
      return 'customer';
    }
    if (user.userType === 'provider' && booking.providerService?.providerId === user.userId) {
      return 'provider';
    }
    throw new ForbiddenException('You do not have access to this conversation');
  }

  private toApprovalView(approval: ChatApproval, booking?: Booking | null): ChatApprovalView {
    return {
      id: approval.id,
      bookingId: approval.bookingId,
      requestedBy: approval.requestedBy,
      status: approval.status,
      serviceName: booking?.serviceName || booking?.providerService?.service?.serviceName || null,
      customerName: booking?.customer?.name ?? null,
      providerName: booking?.providerService?.provider?.providerName ?? null,
      reviewedAt: approval.reviewedAt ?? null,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
    };
  }

  private toMessageView(message: ChatMessage): ChatMessageView {
    return {
      id: message.id,
      bookingId: message.bookingId,
      senderId: message.senderId,
      senderType: message.senderType,
      message: message.message,
      createdAt: message.createdAt,
    };
  }
}
