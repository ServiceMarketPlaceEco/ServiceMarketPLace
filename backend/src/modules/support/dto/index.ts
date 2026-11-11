import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;

// the shape of a uuid, not a strict one: seeded rows have ids like
// a0000001-0000-0000-0000-000000000001, which a strict check refuses
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SendSupportMessageDto {
  @ApiProperty({ example: 'Can I change the time of my booking?' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MaxLength(SUPPORT_MESSAGE_MAX_LENGTH)
  message: string;
}

// which customer or provider an admin is talking to
export class SupportUserParamsDto {
  @ApiProperty({ enum: ['customer', 'provider'] })
  @IsIn(['customer', 'provider'])
  userType: 'customer' | 'provider';

  @ApiProperty()
  @Matches(UUID_SHAPE, { message: 'userId must be an id' })
  userId: string;
}
