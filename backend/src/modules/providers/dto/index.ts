import { IsOptional, IsString, IsNumber, IsBoolean, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProviderProfileDto {
  @ApiPropertyOptional({ example: 'ABC Plumbing Services' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional({ example: 12345678901 })
  @IsOptional()
  @IsNumber()
  abn?: number;

  @ApiPropertyOptional({ example: '456 Business Ave, Melbourne' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @IsNumber()
  postalCode?: number;

  @ApiPropertyOptional({ example: 61412345678 })
  @IsOptional()
  @IsNumber()
  phone?: number;

  @ApiPropertyOptional({ example: 'Professional plumbing services with 10 years experience' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  profileImage?: string;
}

export class AddProviderServiceDto {
  @ApiProperty({ example: 'uuid-of-service' })
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional({ example: 150.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'Expert plumbing repairs and installations' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateProviderServiceDto {
  @ApiPropertyOptional({ example: 175.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'Updated description of service' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: ['confirmed', 'in_progress', 'completed', 'cancelled'] })
  @IsString()
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
}

export class ProviderResponseDto {
  @ApiProperty()
  providerId: string;

  @ApiProperty()
  providerName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  abn: number;

  @ApiProperty()
  address: string;

  @ApiProperty()
  postalCode: number;

  @ApiProperty()
  phone: number;

  @ApiProperty()
  description: string;

  @ApiProperty()
  profileImage: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  totalReviews: number;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class ProviderListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;
}
