import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { UpdateCustomerProfileDto, ChangePasswordDto, CustomerResponseDto } from './dto';
import { JwtAuthGuard, CustomerGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { BookingsService } from '../bookings/bookings.service';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, CustomerGuard)
@ApiBearerAuth('JWT-auth')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current customer profile' })
  @ApiResponse({ status: 200, description: 'Customer profile', type: CustomerResponseDto })
  async getProfile(@CurrentUser() user: CurrentUserData) {
    return this.customersService.getProfile(user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update customer profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: CustomerResponseDto })
  async updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.customersService.updateProfile(user.userId, dto);
  }

  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change customer password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.customersService.changePassword(user.userId, dto);
    return { message: 'Password changed successfully' };
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Get customer bookings' })
  @ApiResponse({ status: 200, description: 'List of customer bookings' })
  async getBookings(@CurrentUser() user: CurrentUserData) {
    return this.bookingsService.findByCustomer(user.userId);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate customer account' })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  async deactivateAccount(@CurrentUser() user: CurrentUserData) {
    await this.customersService.deactivateAccount(user.userId);
    return { message: 'Account deactivated successfully' };
  }
}
