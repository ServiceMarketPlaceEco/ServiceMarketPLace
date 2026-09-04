// admin moderation endpoints for the fake-review queue
//
// these sit under /api/reviews/moderation and drive the admin dashboard:
//   GET  /scan     -> run the detector, return the flagged queue
//   POST /:id/keep  -> admin decided a flagged review is fine, leave it
//   POST /:id/remove -> admin decided its fake, delete it
//
// following the same "public demo" pattern the bookings controller already
// uses for its admin dashboard routes, so it plugs into the existing frontend
// without needing the full jwt admin login wired up first. when you do add
// real admin auth, just drop JwtAuthGuard + AdminGuard onto these like the
// other admin routes.

import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReviewModerationService } from './review-moderation.service';

@ApiTags('reviews')
@Controller('reviews/moderation')
export class ReviewModerationController {
  constructor(private readonly moderationService: ReviewModerationService) {}

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
