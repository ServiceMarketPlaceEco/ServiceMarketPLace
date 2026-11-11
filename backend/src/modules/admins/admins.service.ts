import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin } from './entities/admin.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { BlockReport, ReportStatus } from '../reports/entities/block-report.entity';
import { CreateAdminDto, UpdateAdminDto, AdminDashboardStatsDto } from './dto';
import { AdminRole } from './entities/admin.entity';

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(BlockReport)
    private reportRepository: Repository<BlockReport>,
  ) {}

  // only a super admin can hand out super admin, or change or switch off a
  // super admin. otherwise any admin could give themselves full control
  private assertCanManage(actingRole: string | undefined, targetRole: AdminRole | undefined): void {
    if (targetRole === AdminRole.SUPER_ADMIN && actingRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a super admin can manage super admin accounts');
    }
  }

  async create(createAdminDto: CreateAdminDto, actingRole?: string): Promise<Admin> {
    this.assertCanManage(actingRole, createAdminDto.role);
    const existingAdmin = await this.adminRepository.findOne({
      where: { email: createAdminDto.email },
    });

    if (existingAdmin) {
      throw new ConflictException('Admin with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

    const admin = this.adminRepository.create({
      name: createAdminDto.name,
      email: createAdminDto.email,
      passwordHash: hashedPassword,
      role: createAdminDto.role,
    });

    const savedAdmin = await this.adminRepository.save(admin);
    // never send the password hash back
    const { passwordHash: _hidden, ...safe } = savedAdmin;
    return safe as Admin;
  }

  async findAll(): Promise<Admin[]> {
    return this.adminRepository.find({
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
    });
  }

  async findOne(id: string): Promise<Admin> {
    const admin = await this.adminRepository.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { email },
    });
  }

  async update(id: string, updateAdminDto: UpdateAdminDto, actingRole?: string): Promise<Admin> {
    const admin = await this.findOne(id);
    this.assertCanManage(actingRole, admin.role);
    this.assertCanManage(actingRole, updateAdminDto.role);

    if (updateAdminDto.email && updateAdminDto.email !== admin.email) {
      const existingAdmin = await this.adminRepository.findOne({
        where: { email: updateAdminDto.email },
      });
      if (existingAdmin) {
        throw new ConflictException('Email already in use');
      }
    }

    Object.assign(admin, updateAdminDto);
    return this.adminRepository.save(admin);
  }

  // switching off an admin signs them out straight away (the login check
  // looks at isActive on every request). two rules stop the site being left
  // with nobody who can manage it
  async deactivate(id: string, actingAdminId?: string, actingRole?: string): Promise<Admin> {
    const admin = await this.findOne(id);
    this.assertCanManage(actingRole, admin.role);

    if (actingAdminId && id === actingAdminId) {
      throw new BadRequestException("You can't switch off your own account. Ask another admin to do it.");
    }

    if (admin.isActive) {
      const activeAdmins = await this.adminRepository.count({ where: { isActive: true } });
      if (activeAdmins <= 1) {
        throw new BadRequestException('This is the last active admin, so it has to stay on');
      }
      if (admin.role === AdminRole.SUPER_ADMIN) {
        const activeSuperAdmins = await this.adminRepository.count({
          where: { isActive: true, role: AdminRole.SUPER_ADMIN },
        });
        if (activeSuperAdmins <= 1) {
          throw new BadRequestException(
            'This is the last active super admin. Make another admin a super admin first, so someone can still manage admins.',
          );
        }
      }
    }

    admin.isActive = false;
    return this.adminRepository.save(admin);
  }

  async activate(id: string, actingRole?: string): Promise<Admin> {
    const admin = await this.findOne(id);
    this.assertCanManage(actingRole, admin.role);
    admin.isActive = true;
    return this.adminRepository.save(admin);
  }

  // the signed in admin changes their own password, for example to replace
  // the seeded admin's well-known one
  async changeOwnPassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!ok) {
      throw new BadRequestException('Your current password is not right');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('Choose a password that is different from the current one');
    }
    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.adminRepository.save(admin);
  }

  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    const [
      totalCustomers,
      totalProviders,
      totalBookings,
      pendingBookings,
      completedBookings,
      pendingReports,
    ] = await Promise.all([
      this.customerRepository.count(),
      this.providerRepository.count(),
      this.bookingRepository.count(),
      this.bookingRepository.count({ where: { status: BookingStatus.PENDING } }),
      this.bookingRepository.count({ where: { status: BookingStatus.COMPLETED } }),
      this.reportRepository.count({ where: { status: ReportStatus.PENDING } }),
    ]);

    // Calculate total revenue from completed payments
    const revenueResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: 'completed' })
      .getRawOne();

    const totalRevenue = parseFloat(revenueResult?.total || '0');

    // Get recent bookings
    const recentBookings = await this.bookingRepository.find({
      relations: ['customer', 'providerService'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // Get recent reviews
    const recentReviews = await this.reviewRepository.find({
      relations: ['customer', 'provider'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      totalCustomers,
      totalProviders,
      totalBookings,
      pendingBookings,
      completedBookings,
      totalRevenue,
      pendingReports,
      recentBookings,
      recentReviews,
    };
  }

  async getAllCustomers(page = 1, limit = 10): Promise<{ data: Customer[]; total: number }> {
    const [data, total] = await this.customerRepository.findAndCount({
      select: ['customerId', 'name', 'email', 'phone', 'isActive', 'createdAt'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async getAllProviders(page = 1, limit = 10): Promise<{ data: ServiceProvider[]; total: number }> {
    const [data, total] = await this.providerRepository.findAndCount({
      select: [
        'providerId',
        'providerName',
        'email',
        'phone',
        'isActive',
        'isVerified',
        'rating',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async verifyProvider(providerId: string): Promise<ServiceProvider> {
    const provider = await this.providerRepository.findOne({
      where: { providerId: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    provider.isVerified = true;
    provider.isActive = true;
    return this.providerRepository.save(provider);
  }

  async suspendUser(
    userType: 'customer' | 'provider',
    userId: string,
    reason: string,
  ): Promise<void> {
    if (userType === 'customer') {
      const customer = await this.customerRepository.findOne({
        where: { customerId: userId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      customer.isBlocked = true;
      customer.isActive = false;
      await this.customerRepository.save(customer);
    } else {
      const provider = await this.providerRepository.findOne({
        where: { providerId: userId },
      });
      if (!provider) {
        throw new NotFoundException('Provider not found');
      }
      provider.isBlocked = true;
      provider.isActive = false;
      await this.providerRepository.save(provider);
    }
  }

  async activateUser(userType: 'customer' | 'provider', userId: string): Promise<void> {
    if (userType === 'customer') {
      const customer = await this.customerRepository.findOne({
        where: { customerId: userId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      customer.isBlocked = false;
      customer.isActive = true;
      await this.customerRepository.save(customer);
    } else {
      const provider = await this.providerRepository.findOne({
        where: { providerId: userId },
      });
      if (!provider) {
        throw new NotFoundException('Provider not found');
      }
      provider.isBlocked = false;
      provider.isActive = true;
      await this.providerRepository.save(provider);
    }
  }
}
