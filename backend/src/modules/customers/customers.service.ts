import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Customer } from './entities/customer.entity';
import { UpdateCustomerProfileDto, ChangePasswordDto } from './dto';


@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async findById(customerId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    return this.customerRepository.findOne({ where: { email } });
  }

  async getProfile(customerId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { customerId },
      select: ['customerId', 'name', 'email', 'age', 'phone', 'address', 'profileImage', 'createdAt'],
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto): Promise<Customer> {
    const customer = await this.findById(customerId);
    Object.assign(customer, dto);
    return this.customerRepository.save(customer);
  }

  async changePassword(customerId: string, dto: ChangePasswordDto): Promise<void> {
    const customer = await this.customerRepository.findOne({
      where: { customerId },
      select: ['customerId', 'passwordHash'],
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, customer.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    customer.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.customerRepository.save(customer);
  }

  async deactivateAccount(customerId: string): Promise<void> {
    const customer = await this.findById(customerId);
    customer.isActive = false;
    await this.customerRepository.save(customer);
  }

  // the customer closes their own account. their bookings and reviews stay
  // (providers and the business need the records), but everything that
  // identifies the person is removed and nobody can sign in to it again.
  // asks for the password so a phone left unlocked can't close an account,
  // and waits until no job is under way so a provider isn't left without
  // a way to reach the customer
  async closeAccount(customerId: string, password: string): Promise<void> {
    const customer = await this.customerRepository.findOne({
      where: { customerId },
      select: ['customerId', 'passwordHash'],
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const isPasswordValid = await bcrypt.compare(password ?? '', customer.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    const activeJobs = await this.bookingRepository.count({
      where: { customerId, status: In([BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]) },
    });
    if (activeJobs > 0) {
      throw new BadRequestException(
        'You have a job that is confirmed or in progress. Cancel it or wait until it is finished, then close your account.',
      );
    }

    // requests nobody has picked up yet are cancelled with the account
    await this.bookingRepository.update(
      { customerId, status: BookingStatus.PENDING },
      { status: BookingStatus.CANCELLED },
    );

    await this.customerRepository.update(customerId, {
      name: 'Closed account',
      username: null,
      // unique and can't receive mail (MailService skips .local addresses)
      email: `closed-${customerId}@servicehub.local`,
      // a random hash nobody knows the password for
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
      phone: null as unknown as string,
      address: null as unknown as string,
      age: null as unknown as number,
      profileImage: null as unknown as string,
      isActive: false,
    });
  }

  // Admin methods
  async findAll(): Promise<Customer[]> {
    return this.customerRepository.find({
      select: ['customerId', 'name', 'email', 'age', 'phone', 'isActive', 'isBlocked', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async blockCustomer(customerId: string, block: boolean): Promise<Customer> {
    const customer = await this.findById(customerId);
    customer.isBlocked = block;
    return this.customerRepository.save(customer);
  }
}
