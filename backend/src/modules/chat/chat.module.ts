import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatApproval } from './entities/chat-approval.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Booking } from '../bookings/entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatApproval, ChatMessage, Booking])],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
