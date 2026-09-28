import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminsService } from './admins.service';
import { AdminsController } from './admins.controller';
import { Admin } from './entities/admin.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { BlockReport } from '../reports/entities/block-report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admin,
      Customer,
      ServiceProvider,
      Booking,
      Payment,
      Review,
      BlockReport,
    ]),
  ],
  controllers: [AdminsController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
