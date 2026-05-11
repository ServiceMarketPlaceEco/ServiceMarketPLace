import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, ReviewResponseDto } from './dto';
import { JwtAuthGuard, CustomerGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a review for a completed booking' })
  @ApiResponse({ status: 201, description: 'Review created', type: ReviewResponseDto })
  @ApiResponse({ status: 400, description: 'Can only review completed bookings' })
  @ApiResponse({ status: 409, description: 'Already reviewed this booking' })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.userId, dto);
  }

  @Get('provider/:providerId')
  @ApiOperation({ summary: 'Get all reviews for a provider' })
  @ApiResponse({ status: 200, description: 'List of reviews', type: [ReviewResponseDto] })
  async findByProvider(@Param('providerId') providerId: string) {
    return this.reviewsService.findByProvider(providerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiResponse({ status: 200, description: 'Review details', type: ReviewResponseDto })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id') id: string) {
    return this.reviewsService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update own review' })
  @ApiResponse({ status: 200, description: 'Review updated', type: ReviewResponseDto })
  @ApiResponse({ status: 403, description: 'Can only update own reviews' })
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete own review' })
  @ApiResponse({ status: 200, description: 'Review deleted' })
  @ApiResponse({ status: 403, description: 'Can only delete own reviews' })
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.reviewsService.remove(user.userId, id);
    return { message: 'Review deleted successfully' };
  }
}
