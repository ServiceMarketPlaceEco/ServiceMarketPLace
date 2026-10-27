// admin moderation endpoints for the fake-review queue
//
// these sit under /api/reviews/moderation and drive the admin dashboard:
//   GET  /scan       -> run the detector, return the flagged queue
//   POST /:id/keep   -> admin decided a flagged review is fine, leave it
//   POST /:id/remove -> admin decided its fake, delete it
//   POST /ai-screen  -> ask claude for a second opinion on one flagged review
//
// admin only. JwtAuthGuard checks the login token is real, AdminGuard checks
// the user is actually an admin. they go on the class so every route here is
// covered, including any new ones. before this anyone could scan or delete
// reviews without signing in (H3 in the qa report). the frontend already
// sends the admin token (auth: true in api.js) so nothing changes there.

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
import { ReviewModerationService } from './review-moderation.service';
import { JwtAuthGuard, AdminGuard } from '../../auth/guards';
import { AiScreeningService, AiScreenReviewDto } from '../../../common/ai';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('reviews/moderation')
export class ReviewModerationController {
  constructor(
    private readonly moderationService: ReviewModerationService,
    private readonly aiScreening: AiScreeningService,
  ) {}

  @Get('scan')
  @ApiOperation({ summary: 'Scan all reviews and return the flagged queue (admin)' })
  @ApiResponse({ status: 200, description: 'List of flagged reviews with reasons, worst first' })
  async scan() {
    const flagged = await this.moderationService.scanAllReviews();
    // wrap it so the frontend gets a tidy summary line too
    return {
      flaggedCount: flagged.length,
      queue: flagged,
    };
  }

  // the "Screen with AI" button. no clash with /:id/keep or /:id/remove
  // because those have two parts after /moderation and this only has one
  @Post('ai-screen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask AI for a second opinion on a flagged review (admin)' })
  @ApiResponse({ status: 200, description: '{ verdict, explanation }' })
  @ApiResponse({ status: 503, description: 'ANTHROPIC_API_KEY is not set or Claude is down' })
  async aiScreen(@Body() body: AiScreenReviewDto) {
    // only send what the ai needs to judge it. no ids, names or emails,
    // so we arent sending peoples details to an outside company
    const { rating, comment, score, reasons } = body.review;
    return this.aiScreening.screen('review', {
      rating,
      comment,
      detectorScore: score,
      detectorReasons: Array.isArray(reasons) ? reasons.map((r: any) => r?.detail) : [],
    });
  }

  @Post(':id/keep')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin keeps a flagged review (marks it reviewed, no delete)' })
  @ApiResponse({ status: 200, description: 'Review kept' })
  async keep(@Param('id') id: string) {
    return this.moderationService.keepReview(id);
  }

  @Post(':id/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin removes a fake review' })
  @ApiResponse({ status: 200, description: 'Review removed' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async remove(@Param('id') id: string) {
    return this.moderationService.removeReview(id);
  }
}
