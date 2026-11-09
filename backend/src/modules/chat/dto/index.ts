import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateChatApprovalDto {
  @ApiProperty({ example: 'uuid-of-booking' })
  @IsString()
  @IsNotEmpty()
  bookingId: string;
}

export class UpdateChatApprovalDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';
}

export class ChatMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Only messages for this booking. Required for admins.' })
  @IsOptional()
  @IsString()
  bookingId?: string;
}

export class SendChatMessageDto {
  @ApiProperty({ example: 'uuid-of-booking' })
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({ example: 'I will arrive around 10:30, is that ok?' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MaxLength(CHAT_MESSAGE_MAX_LENGTH)
  message: string;
}
