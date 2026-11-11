import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type SupportUserType = 'customer' | 'provider';

// One conversation between the admin team and one customer or one provider.
// This sits beside the booking chat (modules/chat), which stays between a
// customer and their provider. Admins share one inbox, so any admin can
// answer any thread.
@Entity('support_threads')
@Index(['userType', 'userId'], { unique: true })
export class SupportThread {
  @PrimaryGeneratedColumn('uuid', { name: 'thread_id' })
  id: string;

  @Column({ name: 'user_type', type: 'enum', enum: ['customer', 'provider'] })
  userType: SupportUserType;

  @Column({ name: 'user_id', type: 'varchar', length: 255 })
  userId: string;

  // when each side last opened the thread, for the unread counts
  @Column({ name: 'user_read_at', type: 'datetime', precision: 3, nullable: true })
  userReadAt: Date | null;

  @Column({ name: 'admin_read_at', type: 'datetime', precision: 3, nullable: true })
  adminReadAt: Date | null;

  @Column({ name: 'last_message_at', type: 'datetime', precision: 3, nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
