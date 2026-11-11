import { IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// the shape of a uuid, not a strict one: seeded rows have ids like
// a0000001-0000-0000-0000-000000000001, which a strict check refuses
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// a review is about one of the customer's bookings (bookingId), or about a
// provider they haven't booked through the site (providerId). one of the two
// is needed; ReviewsService.create checks that
export class CreateReviewDto {
  @ApiPropertyOptional({ example: 'uuid-of-booking' })
  @IsOptional()
  @Matches(UUID_SHAPE, { message: 'bookingId must be an id' })
  bookingId?: string;

  // the Rajshahi seed's providers, which also run on the live site, have
  // seeded ids (see UUID_SHAPE)
  @ApiPropertyOptional({ example: 'uuid-of-provider', description: 'When the review is not about a booking' })
  @IsOptional()
  @Matches(UUID_SHAPE, { message: 'providerId must be an id' })
  providerId?: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Great service! Very professional and punctual.' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ example: 'Updated comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ReviewResponseDto {
  @ApiProperty()
  reviewId: string;

  @ApiPropertyOptional({ nullable: true })
  bookingId: string | null;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  providerId: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  comment: string;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  customer?: {
    name: string;
    profileImage: string;
  };
}
