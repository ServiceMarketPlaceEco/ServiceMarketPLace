import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '../entities/admin.entity';

// same rule as customer and provider passwords
const ADMIN_PASSWORD_PATTERN = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
const ADMIN_PASSWORD_MESSAGE = 'Password must contain uppercase, lowercase, and number/special character';

export class ChangeAdminPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(ADMIN_PASSWORD_PATTERN, { message: ADMIN_PASSWORD_MESSAGE })
  newPassword: string;
}

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
  @Matches(ADMIN_PASSWORD_PATTERN, { message: ADMIN_PASSWORD_MESSAGE })
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
