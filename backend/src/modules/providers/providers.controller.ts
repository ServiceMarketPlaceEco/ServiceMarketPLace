import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import {
  UpdateProviderProfileDto,
  AddProviderServiceDto,
  UpdateProviderServiceDto,
  UpdateBookingStatusDto,
  ProviderResponseDto,
  ProviderListQueryDto,
} from './dto';
import { ChangePasswordDto } from '../customers/dto';
import { JwtAuthGuard, ProviderGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { BookingsService } from '../bookings/bookings.service';

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly providersService: ProvidersService,
    private readonly bookingsService: BookingsService,
  ) {}

  // Public endpoints
  @Get()
  @ApiOperation({ summary: 'Get all active providers' })
  @ApiResponse({ status: 200, description: 'List of providers' })
  async findAll(@Query() query: ProviderListQueryDto) {
    return this.providersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get provider public profile by ID' })
  @ApiResponse({ status: 200, description: 'Provider details', type: ProviderResponseDto })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async findOne(@Param('id') id: string) {
    return this.providersService.getPublicProfile(id);
  }

  // Protected endpoints (provider only)
  @Get('me/profile')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current provider profile' })
  @ApiResponse({ status: 200, description: 'Provider profile', type: ProviderResponseDto })
  async getProfile(@CurrentUser() user: CurrentUserData) {
    return this.providersService.getProfile(user.userId);
  }

  @Put('me/profile')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update provider profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: ProviderResponseDto })
  async updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateProviderProfileDto,
  ) {
    return this.providersService.updateProfile(user.userId, dto);
  }

  @Put('me/change-password')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change provider password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.providersService.changePassword(user.userId, dto);
    return { message: 'Password changed successfully' };
  }

  // Provider's services management
  @Get('me/services')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get provider services' })
  @ApiResponse({ status: 200, description: 'List of services offered' })
  async getServices(@CurrentUser() user: CurrentUserData) {
    return this.providersService.getServices(user.userId);
  }

  @Post('me/services')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a new service offering' })
  @ApiResponse({ status: 201, description: 'Service added' })
  @ApiResponse({ status: 409, description: 'Already offering this service' })
  async addService(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AddProviderServiceDto,
  ) {
    return this.providersService.addService(user.userId, dto);
  }

  @Put('me/services/:serviceId')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a service offering' })
  @ApiResponse({ status: 200, description: 'Service updated' })
  async updateService(
    @CurrentUser() user: CurrentUserData,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateProviderServiceDto,
  ) {
    return this.providersService.updateService(user.userId, serviceId, dto);
  }

  @Delete('me/services/:serviceId')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove a service offering' })
  @ApiResponse({ status: 200, description: 'Service removed' })
  async removeService(
    @CurrentUser() user: CurrentUserData,
    @Param('serviceId') serviceId: string,
  ) {
    await this.providersService.removeService(user.userId, serviceId);
    return { message: 'Service removed successfully' };
  }

  // Provider's bookings
  @Get('me/bookings')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get provider bookings' })
  @ApiResponse({ status: 200, description: 'List of provider bookings' })
  async getBookings(@CurrentUser() user: CurrentUserData) {
    return this.bookingsService.findByProvider(user.userId);
  }

  @Put('me/bookings/:bookingId/status')
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update booking status' })
  @ApiResponse({ status: 200, description: 'Booking status updated' })
  async updateBookingStatus(
    @CurrentUser() user: CurrentUserData,
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatusByProvider(user.userId, bookingId, dto.status);
  }
}
