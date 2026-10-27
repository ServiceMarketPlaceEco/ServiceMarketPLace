// admin moderation endpoints for the fake-account queue
//
// these sit under /api/providers/moderation and drive the accounts tab on the
// admin dashboard:
//   GET  /scan      -> run the detector over every provider and customer
//   POST /:id/keep  -> admin decided the account is fine, leave it
//   POST /:id/block -> admin decided its fake, block it (they cant sign in)
//   POST /ai-screen -> ask claude for a second opinion on one flagged account
//
// admin only, same as the review queue. the guards go on the class so every
// route is covered. before this anyone could block any account without
// signing in (H3 in the qa report).

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AccountModerationService } from './account-moderation.service';
import { JwtAuthGuard, AdminGuard } from '../../auth/guards';
import { AiScreeningService, AiScreenAccountDto } from '../../../common/ai';

@ApiTags('providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('providers/moderation')
export class AccountModerationController {
  constructor(
    private readonly moderationService: AccountModerationService,
    private readonly aiScreening: AiScreeningService,
  ) {}

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

  // the "Screen with AI" button on the accounts tab
  @Post('ai-screen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask AI for a second opinion on a flagged account (admin)' })
  @ApiResponse({ status: 200, description: '{ verdict, explanation }' })
  @ApiResponse({ status: 503, description: 'ANTHROPIC_API_KEY is not set or Claude is down' })
  async aiScreen(@Body() body: AiScreenAccountDto) {
    // only the account type, score and the detectors reasons go to the ai.
    // no email or phone - the reasons already say what looked wrong
    const { kind, score, reasons } = body.account;
    return this.aiScreening.screen('account', {
      kind,
      detectorScore: score,
      detectorReasons: Array.isArray(reasons) ? reasons.map((r: any) => r?.detail) : [],
    });
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
