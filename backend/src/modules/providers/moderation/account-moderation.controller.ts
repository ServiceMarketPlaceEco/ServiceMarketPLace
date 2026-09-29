import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountModerationService } from './account-moderation.service';

@ApiTags('providers')
@Controller('providers/moderation')
export class AccountModerationController {
  constructor(private readonly moderationService: AccountModerationService) {}

  @Get('scan')
  @ApiOperation({ summary: 'Scan all accounts and return the flagged queue (admin)' })
  @ApiResponse({ status: 200, description: 'List of flagged accounts with reasons' })
  async scan() {
    const flagged = await this.moderationService.scanAllAccounts();
    return {
      flaggedCount: flagged.length,
      queue: flagged,
    };
  }

  @Post(':id/keep')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin keeps a flagged account (no action taken)' })
  async keep(@Param('id') id: string) {
    return this.moderationService.keepAccount(id);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin blocks a fake account' })
  async block(@Param('id') id: string, @Body() body: { kind: 'provider' | 'customer' }) {
    return this.moderationService.blockAccount(id, body.kind);
  }
}
