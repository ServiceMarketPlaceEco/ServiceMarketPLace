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

  // public list for the reviews page and the home page highlights.
  // has to sit above @Get(':id') so it isnt treated as a review id
  @Get()
  @ApiOperation({ summary: 'Latest public reviews for the reviews page' })
  @ApiResponse({ status: 200, description: 'Up to 50 newest reviews, newest first' })
  async findPublic() {
    return this.reviewsService.findPublic();
  }

  // the signed in customers already reviewed bookings, so the form can hide them
  @Get('mine/booking-ids')
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Booking ids the signed in customer has already reviewed' })
  @ApiResponse({ status: 200, description: 'Array of booking ids' })
  async findMyReviewedBookingIds(@CurrentUser() user: CurrentUserData) {
    return this.reviewsService.findReviewedBookingIds(user.userId);
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
