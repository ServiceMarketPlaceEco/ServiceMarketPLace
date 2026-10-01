import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ example: 'Plumbing' })
  @IsNotEmpty()
  @IsString()
  serviceName: string;

  @ApiPropertyOptional({ example: 'Professional plumbing services' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'wrench' })
  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ServiceResponseDto {
  @ApiProperty()
  serviceId: string;

  @ApiProperty()
  serviceName: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class MatchTranscriptDto {
  @ApiProperty({
    example: 'my aircon stopped blowing cold air',
    description: 'Text from the browser speech-to-text (English or Bengali)',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  transcript: string;

  @ApiPropertyOptional({ example: 'en-AU', enum: ['en-AU', 'bn-BD'] })
  @IsOptional()
  @IsIn(['en-AU', 'bn-BD'])
  language?: string;
}
