import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '../entities/admin.entity';

export class CreateAdminDto {
  @ApiProperty({ description: 'Admin name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Admin password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Admin role', enum: AdminRole })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ description: 'Admin name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Admin email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Admin role', enum: AdminRole })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;
}

export class AdminDashboardStatsDto {
  @ApiProperty()
  totalCustomers: number;

  @ApiProperty()
  totalProviders: number;

  @ApiProperty()
  totalBookings: number;

  @ApiProperty()
  pendingBookings: number;

  @ApiProperty()
  completedBookings: number;

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  pendingReports: number;

  @ApiProperty()
  recentBookings: any[];

  @ApiProperty()
  recentReviews: any[];
}
