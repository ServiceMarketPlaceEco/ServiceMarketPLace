// request bodies for the two "Screen with AI" routes
//
// main.ts rejects any body field it doesnt know about (forbidNonWhitelisted),
// so the routes need a class that declares the field, otherwise every request
// would come back as a 400. the frontend sends the whole flagged item, the
// controllers then pick out only the bits the ai actually needs.

import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiScreenReviewDto {
  @ApiProperty({ description: 'The flagged review from the moderation queue' })
  @IsObject()
  review: Record<string, any>;
}

export class AiScreenAccountDto {
  @ApiProperty({ description: 'The flagged account from the moderation queue' })
  @IsObject()
  account: Record<string, any>;
}
