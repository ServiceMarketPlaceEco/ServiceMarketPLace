import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, PaymentQueryDto, PaymentResponseDto } from './dto';
import { JwtAuthGuard, CustomerGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(CustomerGuard)
  @ApiOperation({ summary: 'Process payment for a booking' })
  @ApiResponse({ status: 201, description: 'Payment processed', type: PaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 400, description: 'Booking already paid' })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment details', type: PaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const payment = await this.paymentsService.findById(id);

    // Verify access
    if (user.userType === 'customer' && payment.customerId !== user.userId) {
      return { error: 'Access denied' };
    }

    return payment;
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get payment for a specific booking' })
  @ApiResponse({ status: 200, description: 'Payment details', type: PaymentResponseDto })
  async findByBooking(@Param('bookingId') bookingId: string) {
    return this.paymentsService.findByBooking(bookingId);
  }

  @Get()
  @UseGuards(CustomerGuard)
  @ApiOperation({ summary: 'Get customer payment history' })
  @ApiResponse({ status: 200, description: 'List of payments', type: [PaymentResponseDto] })
  async findCustomerPayments(
    @CurrentUser() user: CurrentUserData,
    @Query() query: PaymentQueryDto,
  ) {
    return this.paymentsService.findByCustomer(user.userId, query);
  }
}
