import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { ServiceProvider } from '../../providers/entities/service-provider.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { ChatMessage } from './chat-message.entity';

// the three kinds of chat the client asked for:
//   booking          customer <-> provider, one per booking, opens once an
//                    admin has assigned a provider
//   customer_support admin <-> customer, one per customer
//   provider_support admin <-> provider, one per provider
// admins share one inbox, so any admin can answer a support chat and read a
// booking chat.
export enum ConversationType {
  BOOKING = 'booking',
  CUSTOMER_SUPPORT = 'customer_support',
  PROVIDER_SUPPORT = 'provider_support',
}

@Entity('chat_conversations')
export class ChatConversation {
  @PrimaryGeneratedColumn('uuid', { name: 'conversation_id' })
  conversationId: string;

  @Column({ type: 'enum', enum: ConversationType })
  type: ConversationType;

  // 'booking:<id>', 'customer:<id>' or 'provider:<id>'. unique, so two
  // requests at the same moment can't create the same chat twice
  @Index({ unique: true })
  @Column({ name: 'chat_key', type: 'varchar', length: 80 })
  chatKey: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 36, nullable: true })
  customerId: string | null;

  @Column({ name: 'provider_id', type: 'varchar', length: 36, nullable: true })
  providerId: string | null;

  @Column({ name: 'booking_id', type: 'varchar', length: 36, nullable: true })
  bookingId: string | null;

  // when each side last opened the chat, for the unread counts
  @Column({ name: 'customer_read_at', type: 'datetime', precision: 3, nullable: true })
  customerReadAt: Date | null;

  @Column({ name: 'provider_read_at', type: 'datetime', precision: 3, nullable: true })
  providerReadAt: Date | null;

  @Column({ name: 'admin_read_at', type: 'datetime', precision: 3, nullable: true })
  adminReadAt: Date | null;

  @Column({ name: 'last_message_at', type: 'datetime', precision: 3, nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => ServiceProvider, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: ServiceProvider | null;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking | null;

  @OneToMany(() => ChatMessage, (message) => message.conversation)
  messages: ChatMessage[];
}
