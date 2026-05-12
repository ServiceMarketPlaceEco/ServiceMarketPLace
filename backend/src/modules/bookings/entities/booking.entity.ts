import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { ProviderService } from '../../providers/entities/provider-service.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Review } from '../../reviews/entities/review.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid', { name: 'booking_id' })
  bookingId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'provider_service_id', type: 'varchar', length: 36, nullable: true })
  providerServiceId: string | null;

  @Column({ name: 'job_id', type: 'varchar', length: 36, nullable: true })
  jobId: string | null;

  @Column({ name: 'payment_id', type: 'varchar', length: 36, nullable: true })
  paymentId: string | null;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time' })
  time: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.bookings)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => ProviderService, (ps) => ps.bookings)
  @JoinColumn({ name: 'provider_service_id' })
  providerService: ProviderService;

  @OneToOne(() => Payment, (payment) => payment.booking)
  payment: Payment;

  @OneToMany(() => Review, (review) => review.booking)
  reviews: Review[];
}
