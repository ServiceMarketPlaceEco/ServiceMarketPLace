import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ChatConversation } from './chat-conversation.entity';

export enum ChatSender {
  CUSTOMER = 'customer',
  PROVIDER = 'provider',
  ADMIN = 'admin',
}

@Entity('chat_messages')
@Index(['conversationId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid', { name: 'message_id' })
  messageId: string;

  @Column({ name: 'conversation_id', type: 'varchar', length: 36 })
  conversationId: string;

  @Column({ name: 'sender_type', type: 'enum', enum: ChatSender })
  senderType: ChatSender;

  @Column({ name: 'sender_id', type: 'varchar', length: 36 })
  senderId: string;

  // kept on the message so the name still shows if the account changes later
  @Column({ name: 'sender_name', type: 'varchar', length: 255 })
  senderName: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt: Date;

  @ManyToOne(() => ChatConversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ChatConversation;
}
