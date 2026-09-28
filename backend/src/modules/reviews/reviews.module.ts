import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Review } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Customer } from '../customers/entities/customer.entity';
import { MailModule } from '../mail/mail.module';
import { ReviewModerationController } from './moderation/review-moderation.controller';
import { ReviewModerationService } from './moderation/review-moderation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Booking, ServiceProvider, Customer]),
    MailModule,
  ],
  controllers: [ReviewsController, ReviewModerationController],
  providers: [ReviewsService, ReviewModerationService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
