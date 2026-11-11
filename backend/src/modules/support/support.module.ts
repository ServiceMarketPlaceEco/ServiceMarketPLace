import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportThread } from './entities/support-thread.entity';
import { SupportMessage } from './entities/support-message.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupportThread, SupportMessage, Customer, ServiceProvider])],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
