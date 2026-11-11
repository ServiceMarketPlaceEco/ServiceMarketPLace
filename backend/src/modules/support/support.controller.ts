// Chat between the admin team and a customer or provider.
//
// customer or provider:
//   GET  /support/messages         my conversation with the admin team
//   POST /support/messages         send the admin team a message
// admin:
//   GET  /support/threads                              the inbox
//   GET  /support/threads/:userType/:userId/messages   one conversation
//   POST /support/threads/:userType/:userId/messages   reply, or start one
// everyone:
//   GET  /support/unread           unread count for the dashboard badge
//
// The booking chat between a customer and their provider is separate
// (modules/chat) and is not changed by this.

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { SendSupportMessageDto, SupportUserParamsDto } from './dto';
import { AdminGuard, JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('support')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('unread')
  @ApiOperation({ summary: 'How many support messages the signed in user has not read' })
  async unread(@CurrentUser() user: CurrentUserData) {
    const unread =
      user.userType === 'admin'
        ? await this.supportService.unreadForAdmins()
        : await this.supportService.unreadForUser(user);
    return { unread };
  }

  @Get('messages')
  @ApiOperation({ summary: 'My conversation with the admin team (customer or provider)' })
  @ApiResponse({ status: 403, description: 'Admins use the inbox instead' })
  myMessages(@CurrentUser() user: CurrentUserData) {
    return this.supportService.getMyMessages(user);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send the admin team a message (customer or provider)' })
  @ApiResponse({ status: 403, description: 'Admins use the inbox instead' })
  send(@CurrentUser() user: CurrentUserData, @Body() dto: SendSupportMessageDto) {
    return this.supportService.sendAsUser(user, dto.message);
  }

  @Get('threads')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin inbox: every conversation with messages, newest first' })
  threads() {
    return this.supportService.listThreads();
  }

  @Get('threads/:userType/:userId/messages')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'One conversation, oldest message first (admin). Marks it read' })
  @ApiResponse({ status: 404, description: 'No such customer or provider' })
  threadMessages(@Param() params: SupportUserParamsDto) {
    return this.supportService.getMessagesAsAdmin(params.userType, params.userId);
  }

  @Post('threads/:userType/:userId/messages')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Reply to, or start, a conversation with a customer or provider (admin)' })
  @ApiResponse({ status: 404, description: 'No such customer or provider' })
  reply(
    @CurrentUser() user: CurrentUserData,
    @Param() params: SupportUserParamsDto,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportService.sendAsAdmin(user, params.userType, params.userId, dto.message);
  }
}
