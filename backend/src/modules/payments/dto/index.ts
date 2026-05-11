import { IsNotEmpty, IsOptional, IsString, IsUUID, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '../entities/payment.entity';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-of-booking' })
  @IsUUID()
  bookingId: string;

  @ApiProperty({ example: 150.00 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: PaymentMethod, example: 'credit_card' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'txn_12345' })
  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class PaymentQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string;
}

export class PaymentResponseDto {
  @ApiProperty()
  paymentId: string;

  @ApiProperty()
  bookingId: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty()
  transactionId: string;

  @ApiProperty()
  paymentDate: Date;

  @ApiProperty()
  createdAt: Date;
}
