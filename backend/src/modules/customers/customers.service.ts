import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Customer } from './entities/customer.entity';
import { UpdateCustomerProfileDto, ChangePasswordDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
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
