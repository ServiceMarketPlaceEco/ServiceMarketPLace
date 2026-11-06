// chat between customers, providers and admins
//
//   GET  /chat/conversations                 the signed in user's chats
//   POST /chat/conversations/support         admin opens a chat with a user
//   GET  /chat/conversations/:id/messages    messages (?after= for refreshes)
//   POST /chat/conversations/:id/messages    send a message
//
// everyone has to be signed in. who can see which chat is checked in
// ChatService.canAccess. the website refreshes every 5 seconds instead of
// keeping a live connection open, so it works behind any server or proxy.

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { MessagesQueryDto, SendMessageDto, StartSupportChatDto } from './dto';
import { AdminGuard, JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Chats for the signed in user, newest first, with unread counts' })
  async list(@CurrentUser() user: CurrentUserData) {
    return this.chatService.listConversations(user);
  }

  @Post('conversations/support')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin opens a chat with a customer or provider' })
  @ApiResponse({ status: 404, description: 'No such customer or provider' })
  async startSupport(@CurrentUser() user: CurrentUserData, @Body() dto: StartSupportChatDto) {
    return this.chatService.startSupportChat(user, dto.userType, dto.userId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Messages in a chat, oldest first. Marks the chat as read' })
  @ApiResponse({ status: 404, description: 'Chat not found or not yours' })
  async messages(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.chatService.getMessages(user, id, query.after);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'The saved message' })
  @ApiResponse({ status: 404, description: 'Chat not found or not yours' })
  async send(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user, id, dto.body);
  }
}
