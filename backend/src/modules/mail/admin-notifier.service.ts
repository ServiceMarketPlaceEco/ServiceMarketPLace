import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../admins/entities/admin.entity';
import { MailService } from './mail.service';

// Emails every active admin when something is waiting for them: a message
// from a customer or provider, a chat request, or a review to approve.
// Before this the only way to find out was to keep checking the dashboard.
// A failed email never stops the action that caused it.
@Injectable()
export class AdminNotifierService {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private mailService: MailService,
  ) {}

  async notify(subject: string, intro: string, quote?: string): Promise<void> {
    try {
      const admins = await this.adminRepository.find({ where: { isActive: true }, select: { email: true } });
      await this.mailService.sendAdminNotification(
        admins.map((admin) => admin.email),
        subject,
        intro,
        quote,
      );
    } catch (error) {
      console.error('Failed to notify the admin team:', error);
    }
  }
}
