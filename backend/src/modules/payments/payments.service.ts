import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { CreatePaymentDto, PaymentQueryDto } from './dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private mailService: MailService,
  ) {}

  async create(customerId: string, dto: CreatePaymentDto): Promise<Payment> {
    // Verify booking exists and belongs to customer
    const booking = await this.bookingRepository.findOne({
      where: { bookingId: dto.bookingId },
      relations: ['providerService', 'providerService.provider', 'providerService.service', 'customer'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only pay for your own bookings');
    }

    // Check if payment already exists
    const existingPayment = await this.paymentRepository.findOne({
      where: { bookingId: dto.bookingId, status: PaymentStatus.COMPLETED },
    });

    if (existingPayment) {
      throw new BadRequestException('Booking already paid');
    }

    // Create payment
    const payment = this.paymentRepository.create({
      bookingId: dto.bookingId,
      customerId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      transactionId: dto.transactionId,
      status: PaymentStatus.COMPLETED, // In real app, this would depend on payment gateway
      paymentDate: new Date(),
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Update booking with payment ID
    booking.paymentId = savedPayment.paymentId;
    await this.bookingRepository.save(booking);

    // Send payment confirmation email
    await this.mailService.sendPaymentConfirmation(savedPayment, booking);

    return savedPayment;
  }

  async findById(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { paymentId },
      relations: ['customer', 'booking'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findByBooking(bookingId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { bookingId },
    });
  }

  async findByCustomer(customerId: string, query?: PaymentQueryDto): Promise<Payment[]> {
    const where: any = { customerId };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.fromDate && query?.toDate) {
      where.paymentDate = Between(new Date(query.fromDate), new Date(query.toDate));
    } else if (query?.fromDate) {
      where.paymentDate = MoreThanOrEqual(new Date(query.fromDate));
    } else if (query?.toDate) {
      where.paymentDate = LessThanOrEqual(new Date(query.toDate));
    }

    return this.paymentRepository.find({
      where,
      relations: ['booking'],
      order: { paymentDate: 'DESC' },
    });
  }

  // Admin methods
  async findAll(query?: PaymentQueryDto): Promise<Payment[]> {
    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.fromDate && query?.toDate) {
      where.paymentDate = Between(new Date(query.fromDate), new Date(query.toDate));
    }

    return this.paymentRepository.find({
      where,
      relations: ['customer', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async refund(paymentId: string): Promise<Payment> {
    const payment = await this.findById(paymentId);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    payment.status = PaymentStatus.REFUNDED;
    return this.paymentRepository.save(payment);
  }

  async getStats(): Promise<any> {
    const total = await this.paymentRepository.count();
    const completed = await this.paymentRepository.count({ where: { status: PaymentStatus.COMPLETED } });
    const refunded = await this.paymentRepository.count({ where: { status: PaymentStatus.REFUNDED } });

    const totalAmount = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .select('SUM(payment.amount)', 'total')
      .getRawOne();

    return {
      total,
      completed,
      refunded,
      totalRevenue: totalAmount?.total || 0,
    };
  }
}
