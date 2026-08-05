import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { ProviderService } from '../providers/entities/provider-service.entity';
import { CreateBookingDto, UpdateBookingDto, BookingQueryDto } from './dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(ProviderService)
    private providerServiceRepository: Repository<ProviderService>,
    private mailService: MailService,
  ) {}

  async create(customerId: string, dto: CreateBookingDto): Promise<Booking> {
    let providerService = null;
    let totalAmount = null;

    // If providerServiceId is provided, verify it exists
    if (dto.providerServiceId) {
      providerService = await this.providerServiceRepository.findOne({
        where: { id: dto.providerServiceId, isAvailable: true },
        relations: ['provider', 'service'],
      });

      if (!providerService) {
        throw new NotFoundException('Service not available');
      }

      if (providerService.provider.isBlocked || !providerService.provider.isActive) {
        throw new BadRequestException('Provider is not available');
      }

      totalAmount = providerService.price;
    }

    // Create booking with flexible fields
    const booking = new Booking();
    booking.customerId = customerId;
    booking.providerServiceId = dto.providerServiceId || null;
    booking.date = new Date(dto.date);
    booking.time = dto.time;
    booking.notes = dto.notes || dto.serviceName || null;
    booking.address = dto.address ?? null;
    booking.totalAmount = totalAmount;
    booking.status = BookingStatus.PENDING;
    booking.jobId = dto.serviceId || null;
    booking.serviceName = providerService?.service?.serviceName || dto.serviceName || null;

    const savedBooking = await this.bookingRepository.save(booking);

    // Send confirmation emails if provider service exists
    if (providerService) {
      try {
        await this.mailService.sendBookingConfirmation(
          savedBooking,
          providerService.provider,
          providerService.service,
        );
      } catch (error) {
        console.error('Failed to send booking confirmation email:', error);
      }
    }

    return savedBooking;
  }

  async findById(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { bookingId },
      relations: ['customer', 'providerService', 'providerService.provider', 'providerService.service'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async findByCustomer(customerId: string, query?: BookingQueryDto): Promise<Booking[]> {
    const where: any = { customerId };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.fromDate && query?.toDate) {
      where.date = Between(new Date(query.fromDate), new Date(query.toDate));
    } else if (query?.fromDate) {
      where.date = MoreThanOrEqual(new Date(query.fromDate));
    } else if (query?.toDate) {
      where.date = LessThanOrEqual(new Date(query.toDate));
    }

    return this.bookingRepository.find({
      where,
      relations: ['providerService', 'providerService.provider', 'providerService.service'],
      order: { date: 'DESC', time: 'DESC' },
    });
  }

  async findByProvider(providerId: string, query?: BookingQueryDto): Promise<Booking[]> {
    const providerServices = await this.providerServiceRepository.find({
      where: { providerId },
      select: ['id'],
    });

    const serviceIds = providerServices.map((ps) => ps.id);

    if (serviceIds.length === 0) {
      return [];
    }

    const qb = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.customer', 'customer')
      .leftJoinAndSelect('booking.providerService', 'providerService')
      .leftJoinAndSelect('providerService.service', 'service')
      .where('booking.providerServiceId IN (:...serviceIds)', { serviceIds });

    if (query?.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }

    if (query?.fromDate) {
      qb.andWhere('booking.date >= :fromDate', { fromDate: query.fromDate });
    }

    if (query?.toDate) {
      qb.andWhere('booking.date <= :toDate', { toDate: query.toDate });
    }

    return qb.orderBy('booking.date', 'DESC').addOrderBy('booking.time', 'DESC').getMany();
  }

  async update(customerId: string, bookingId: string, dto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only update your own bookings');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Can only update pending bookings');
    }

    if (dto.date) {
      booking.date = new Date(dto.date);
    }
    if (dto.time) {
      booking.time = dto.time;
    }
    if (dto.notes !== undefined) {
      booking.notes = dto.notes;
    }
    if (dto.address !== undefined) {
    booking.address = dto.address || null;
    }

    return this.bookingRepository.save(booking);
  }

  async cancel(customerId: string, bookingId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    if ([BookingStatus.COMPLETED, BookingStatus.CANCELLED].includes(booking.status)) {
      throw new BadRequestException('Cannot cancel this booking');
    }

    booking.status = BookingStatus.CANCELLED;
    const cancelledBooking = await this.bookingRepository.save(booking);

    // Send cancellation email
    await this.mailService.sendBookingCancellation(cancelledBooking);

    return cancelledBooking;
  }

  async updateStatusByProvider(
    providerId: string,
    bookingId: string,
    status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled',
  ): Promise<Booking> {
    const booking = await this.findById(bookingId);

    // Verify this booking belongs to provider's service
    if (booking.providerService.providerId !== providerId) {
      throw new ForbiddenException('You can only update your own bookings');
    }

    // Validate status transitions
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
      [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
    };

    const newStatus = status as BookingStatus;
    if (!validTransitions[booking.status].includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${booking.status} to ${status}`);
    }

    booking.status = newStatus;
    const updatedBooking = await this.bookingRepository.save(booking);

    // Send status update email
    await this.mailService.sendBookingStatusUpdate(updatedBooking, newStatus);

    return updatedBooking;
  }

  // Admin methods
  async findAll(query?: BookingQueryDto): Promise<Booking[]> {
    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.fromDate && query?.toDate) {
      where.date = Between(new Date(query.fromDate), new Date(query.toDate));
    }

    return this.bookingRepository.find({
      where,
      relations: ['customer', 'providerService', 'providerService.provider', 'providerService.service'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatusAdmin(bookingId: string, status: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Map status string to enum
    const statusMap: Record<string, BookingStatus> = {
      'pending': BookingStatus.PENDING,
      'Pending': BookingStatus.PENDING,
      'accepted': BookingStatus.CONFIRMED,
      'Accepted': BookingStatus.CONFIRMED,
      'confirmed': BookingStatus.CONFIRMED,
      'Confirmed': BookingStatus.CONFIRMED,
      'in_progress': BookingStatus.IN_PROGRESS,
      'In Progress': BookingStatus.IN_PROGRESS,
      'completed': BookingStatus.COMPLETED,
      'Completed': BookingStatus.COMPLETED,
      'cancelled': BookingStatus.CANCELLED,
      'Cancelled': BookingStatus.CANCELLED,
    };

    const newStatus = statusMap[status];
    if (!newStatus) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    booking.status = newStatus;
    return this.bookingRepository.save(booking);
  }

  async getStats(): Promise<any> {
    const total = await this.bookingRepository.count();
    const pending = await this.bookingRepository.count({ where: { status: BookingStatus.PENDING } });
    const confirmed = await this.bookingRepository.count({ where: { status: BookingStatus.CONFIRMED } });
    const inProgress = await this.bookingRepository.count({ where: { status: BookingStatus.IN_PROGRESS } });
    const completed = await this.bookingRepository.count({ where: { status: BookingStatus.COMPLETED } });
    const cancelled = await this.bookingRepository.count({ where: { status: BookingStatus.CANCELLED } });

    return { total, pending, confirmed, inProgress, completed, cancelled };
  }
}
