import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SupportThread } from './support-thread.entity';

export type SupportSenderType = 'customer' | 'provider' | 'admin';

@Entity('support_messages')
@Index(['threadId', 'createdAt'])
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid', { name: 'message_id' })
  id: string;

  @Column({ name: 'thread_id', type: 'varchar', length: 36 })
  threadId: string;

  @Column({ name: 'sender_type', type: 'enum', enum: ['customer', 'provider', 'admin'] })
  senderType: SupportSenderType;

  @Column({ name: 'sender_id', type: 'varchar', length: 255 })
  senderId: string;

  // kept on the message so the name still shows if the account changes later
  @Column({ name: 'sender_name', type: 'varchar', length: 255 })
  senderName: string;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'created_at', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt: Date;

  @ManyToOne(() => SupportThread, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread: SupportThread;
}
