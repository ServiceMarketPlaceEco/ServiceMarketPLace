import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, IsIn, IsISO8601 } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'Hi, I will be there at 10:30.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Type a message first' })
  @MaxLength(2000)
  body: string;
}

// admin starting a chat with someone who hasn't messaged yet
export class StartSupportChatDto {
  @ApiProperty({ enum: ['customer', 'provider'] })
  @IsIn(['customer', 'provider'])
  userType: 'customer' | 'provider';

  @ApiProperty()
  @IsUUID()
  userId: string;
}

export class MessagesQueryDto {
  // only messages newer than this, so the 5 second refresh stays small
  @ApiPropertyOptional({ example: '2026-11-06T02:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  after?: string;
}
