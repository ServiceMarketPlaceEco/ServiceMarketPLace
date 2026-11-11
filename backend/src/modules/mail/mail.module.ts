import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailService } from './mail.service';
import { AdminNotifierService } from './admin-notifier.service';
import { Admin } from '../admins/entities/admin.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Admin])],
  providers: [MailService, AdminNotifierService],
  exports: [MailService, AdminNotifierService],
})
export class MailModule {}
