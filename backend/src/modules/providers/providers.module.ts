import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ServiceProvider } from './entities/service-provider.entity';
import { ProviderService } from './entities/provider-service.entity';
import { BookingsModule } from '../bookings/bookings.module';
import { AccountModerationController } from './moderation/account-moderation.controller';
import { AccountModerationService } from './moderation/account-moderation.service';
import { Customer } from '../customers/entities/customer.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Review } from '../reviews/entities/review.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceProvider, ProviderService, Customer, Booking, Review]),
    forwardRef(() => BookingsModule),
  ],
  controllers: [ProvidersController, AccountModerationController],
  providers: [ProvidersService, AccountModerationService],
  exports: [ProvidersService],
})
export class ProvidersModule {}