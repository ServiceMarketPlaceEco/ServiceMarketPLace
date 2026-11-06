import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

export enum ChatApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export type ChatParticipantType = 'customer' | 'provider';

// Chat between a customer and their provider is opened per booking, and only
// after an admin approves it. One approval row per booking: asking again after
// a rejection moves the same row back to pending.
@Entity('chat_approvals')
export class ChatApproval {
  @PrimaryGeneratedColumn('uuid', { name: 'approval_id' })
  id: string;

  @Column({ name: 'booking_id', type: 'varchar', length: 36, unique: true })
  bookingId: string;

  @Column({ name: 'requested_by', type: 'enum', enum: ['customer', 'provider'] })
  requestedBy: ChatParticipantType;

  @Column({ name: 'requested_by_id', type: 'varchar', length: 255 })
  requestedById: string;

  @Column({
    type: 'enum',
    enum: ChatApprovalStatus,
    default: ChatApprovalStatus.PENDING,
  })
  status: ChatApprovalStatus;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 255, nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
