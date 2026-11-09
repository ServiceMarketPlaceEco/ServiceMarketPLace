import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  CreateChatApprovalDto,
  UpdateChatApprovalDto,
  ChatMessagesQueryDto,
  SendChatMessageDto,
} from './dto';
import { JwtAuthGuard, AdminGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

// Customer <-> provider chat, one conversation per booking. Either side asks
// to open it, an admin approves it, then both can send messages.
@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('approvals')
  @ApiOperation({ summary: 'List chat approvals (all for admins, own bookings otherwise)' })
  @ApiResponse({ status: 200, description: 'List of chat approvals' })
  listApprovals(@CurrentUser() user: CurrentUserData) {
    return this.chatService.listApprovals(user);
  }

  @Post('approvals')
  @ApiOperation({ summary: 'Ask an admin to open chat on a booking (customer or assigned provider)' })
  @ApiResponse({ status: 201, description: 'Approval requested (or the existing one returned)' })
  @ApiResponse({ status: 400, description: 'No provider assigned yet, or booking cancelled' })
  @ApiResponse({ status: 403, description: 'Not the customer or provider on this booking' })
  requestApproval(@CurrentUser() user: CurrentUserData, @Body() dto: CreateChatApprovalDto) {
    return this.chatService.requestApproval(user, dto.bookingId);
  }

  @Patch('approvals/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Approve or reject a chat request (Admin only)' })
  @ApiResponse({ status: 200, description: 'Approval updated' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  reviewApproval(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateChatApprovalDto,
  ) {
    return this.chatService.reviewApproval(user.userId, id, dto.status);
  }

  @Get('messages')
  @ApiOperation({ summary: 'List chat messages, for one booking or across your own bookings' })
  @ApiResponse({ status: 200, description: 'Messages, oldest first' })
  @ApiResponse({ status: 403, description: 'Not the customer or provider on this booking' })
  listMessages(@CurrentUser() user: CurrentUserData, @Query() query: ChatMessagesQueryDto) {
    return this.chatService.listMessages(user, query.bookingId);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message on a booking whose chat an admin approved' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 403, description: 'Not a participant, or chat not approved' })
  sendMessage(@CurrentUser() user: CurrentUserData, @Body() dto: SendChatMessageDto) {
    return this.chatService.sendMessage(user, dto);
  }
}
