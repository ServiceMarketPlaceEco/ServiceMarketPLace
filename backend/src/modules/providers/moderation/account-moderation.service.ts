import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceProvider } from '../entities/service-provider.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { Review } from '../../reviews/entities/review.entity';
import {
  scanAccounts,
  ScorableAccount,
  AccountScore,
  ACCOUNT_DETECTION_CONFIG,
} from './fake-account-detector';

@Injectable()
export class AccountModerationService {
  constructor(
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
  ) {}

  async scanAllAccounts(): Promise<AccountScore[]> {
    const providers = await this.providerRepository.find();
    const customers = await this.customerRepository.find();

    const scorable: ScorableAccount[] = [];

    for (const p of providers) {
      const completedBookings = await this.bookingRepository.count({
        where: { providerService: { providerId: p.providerId } as any, status: BookingStatus.COMPLETED },
      });

      scorable.push({
        accountId: p.providerId,
        kind: 'provider',
        email: p.email,
        phone: p.phone ? String(p.phone) : null,
        createdAt: p.createdAt,
        nid: p.abn, // ABN field used in place of NID for now
        completedBookings,
      });
    }

    for (const c of customers) {
      const completedBookings = await this.bookingRepository.count({
        where: { customerId: c.customerId, status: BookingStatus.COMPLETED },
      });
      const reviews = await this.reviewRepository.find({
        where: { customerId: c.customerId },
      });
      const distinctProviders = new Set(reviews.map(r => r.providerId)).size;

      scorable.push({
        accountId: c.customerId,
        kind: 'customer',
        email: c.email,
        phone: c.phone ? String(c.phone) : null,
        createdAt: c.createdAt,
        completedBookings,
        reviewsWritten: reviews.length,
        distinctProvidersReviewed: distinctProviders,
      });
    }

    return scanAccounts(scorable, ACCOUNT_DETECTION_CONFIG);
  }

  async blockAccount(accountId: string, kind: 'provider' | 'customer'): Promise<{ accountId: string; blocked: boolean }> {
    if (kind === 'provider') {
      const provider = await this.providerRepository.findOne({ where: { providerId: accountId } });
      if (!provider) throw new NotFoundException('Provider not found');
      provider.isBlocked = true;
      provider.isActive = false;
      await this.providerRepository.save(provider);
    } else {
      const customer = await this.customerRepository.findOne({ where: { customerId: accountId } });
      if (!customer) throw new NotFoundException('Customer not found');
      customer.isBlocked = true;
      customer.isActive = false;
      await this.customerRepository.save(customer);
    }
    return { accountId, blocked: true };
  }

  async keepAccount(accountId: string): Promise<{ accountId: string; kept: boolean }> {
    // just confirm the account exists, no action taken
    const provider = await this.providerRepository.findOne({ where: { providerId: accountId } });
    const customer = provider ? null : await this.customerRepository.findOne({ where: { customerId: accountId } });
    if (!provider && !customer) throw new NotFoundException('Account not found');
    return { accountId, kept: true };
  }
}
