import { IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportedType, ReportStatus } from '../entities/block-report.entity';

export class CreateReportDto {
  @ApiProperty({ example: 'uuid-of-reported-user' })
  @IsUUID()
  reportedId: string;

  @ApiProperty({ enum: ReportedType, example: 'provider' })
  @IsEnum(ReportedType)
  reportedType: ReportedType;

  @ApiProperty({ example: 'This provider was very unprofessional and rude.' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ReportStatus, example: 'reviewed' })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({ example: 'Warning issued to provider' })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class ReportQueryDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: ReportedType })
  @IsOptional()
  @IsEnum(ReportedType)
  reportedType?: ReportedType;
}

export class ReportResponseDto {
  @ApiProperty()
  reportId: string;

  @ApiProperty()
  reporterId: string;

  @ApiProperty()
  reporterType: string;

  @ApiProperty()
  reportedId: string;

  @ApiProperty()
  reportedType: string;

  @ApiProperty()
  reason: string;

  @ApiProperty({ enum: ReportStatus })
  status: ReportStatus;

  @ApiProperty()
  adminNotes: string;

  @ApiProperty()
  resolvedBy: string;

  @ApiProperty()
  createdAt: Date;
}
