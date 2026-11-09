import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { ChatParticipantType } from './chat-approval.entity';

// A message between the customer and the provider of one booking.
@Entity('chat_messages')
@Index(['bookingId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid', { name: 'message_id' })
  id: string;

  @Column({ name: 'booking_id', type: 'varchar', length: 36 })
  bookingId: string;

  @Column({ name: 'sender_id', type: 'varchar', length: 255 })
  senderId: string;

  @Column({ name: 'sender_type', type: 'enum', enum: ['customer', 'provider'] })
  senderType: ChatParticipantType;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
