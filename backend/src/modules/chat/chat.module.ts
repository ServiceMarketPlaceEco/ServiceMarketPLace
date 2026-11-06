import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatConversation, ChatMessage, Booking, Customer, ServiceProvider])],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
