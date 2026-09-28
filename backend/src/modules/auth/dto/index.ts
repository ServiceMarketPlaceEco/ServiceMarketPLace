import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, Matches, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserTypeDto {
  CUSTOMER = 'customer',
  PROVIDER = 'provider',
  ADMIN = 'admin',
}

export class RegisterCustomerDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, and number/special character',
  })
  password: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  age?: number;

  @ApiPropertyOptional({ example: '0412345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '123 Main St, Sydney' })
  @IsOptional()
  @IsString()
  address?: string;
}

export class RegisterProviderDto {
  @ApiProperty({ example: 'ABC Plumbing Services' })
  @IsNotEmpty()
  @IsString()
  providerName: string;

  @ApiProperty({ example: 'provider@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, and number/special character',
  })
  password: string;

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
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ enum: UserTypeDto, example: 'customer' })
  @IsEnum(UserTypeDto)
  userType: UserTypeDto;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: UserTypeDto, example: 'customer' })
  @IsEnum(UserTypeDto)
  userType: UserTypeDto;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, and number/special character',
  })
  newPassword: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: any;

  @ApiProperty()
  userType: string;
}
