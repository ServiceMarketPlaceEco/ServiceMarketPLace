import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { ServiceProvider } from '../../providers/entities/service-provider.entity';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid', { name: 'review_id' })
  reviewId: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Booking, (booking) => booking.reviews)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Customer, (customer) => customer.reviews)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => ServiceProvider, (provider) => provider.reviews)
  @JoinColumn({ name: 'provider_id' })
  provider: ServiceProvider;
}
