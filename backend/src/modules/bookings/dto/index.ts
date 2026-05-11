import { IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '../entities/booking.entity';

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-of-provider-service' })
  @IsUUID()
  providerServiceId: string;

  @ApiProperty({ example: '2024-12-25' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  time: string;

  @ApiPropertyOptional({ example: 'Please arrive early' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '123 Customer Street, Sydney' })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateBookingDto {
  @ApiPropertyOptional({ example: '2024-12-26' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '11:00' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({ example: 'Updated notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'New address' })
  @IsOptional()
  @IsString()
  address?: string;
}

export class BookingQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class BookingResponseDto {
  @ApiProperty()
  bookingId: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  providerServiceId: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  time: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty()
  notes: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  createdAt: Date;
}
