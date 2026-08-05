import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingDto, BookingQueryDto, BookingResponseDto } from './dto';
import { JwtAuthGuard, CustomerGuard, AdminGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all bookings (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all bookings' })
  async findAll(@Query() query: BookingQueryDto) {
    return this.bookingsService.findAll(query);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all bookings (Public - for demo admin dashboard)' })
  @ApiResponse({ status: 200, description: 'List of all bookings' })
  async findAllPublic(@Query() query: BookingQueryDto) {
    return this.bookingsService.findAll(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status (Public - for demo admin)' })
  @ApiResponse({ status: 200, description: 'Booking status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.bookingsService.updateStatusAdmin(id, body.status);
  }

  @Post()
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new booking (Customer only)' })
  @ApiResponse({ status: 201, description: 'Booking created', type: BookingResponseDto })
  @ApiResponse({ status: 404, description: 'Service not available' })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(user.userId, dto);
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all bookings for the current customer' })
  @ApiResponse({ status: 200, description: 'List of customer bookings' })
  async getMyBookings(
    @CurrentUser() user: CurrentUserData,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.findByCustomer(user.userId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking details', type: BookingResponseDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const booking = await this.bookingsService.findById(id);
    
    // Verify access - customer can see their own, provider can see theirs
    if (user.userType === 'customer' && booking.customerId !== user.userId) {
      return { error: 'Access denied' };
    }
    if (user.userType === 'provider' && booking.providerService?.providerId !== user.userId) {
      return { error: 'Access denied' };
    }

    return booking;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update booking (Customer only, pending bookings)' })
  @ApiResponse({ status: 200, description: 'Booking updated', type: BookingResponseDto })
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(user.userId, id, dto);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel a booking (Customer only)' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  async cancel(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    return this.bookingsService.cancel(user.userId, id);
  }
}
