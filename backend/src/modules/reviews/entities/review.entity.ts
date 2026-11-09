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

// every new review waits for an admin before it goes live (the client asked
// for this, so a review about a no-show can be checked first). reviews from
// before this change count as approved, which is why the column default is
// approved and ReviewsService.create sets pending itself.
export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid', { name: 'review_id' })
  reviewId: string;

  // empty when a customer reviews a provider they haven't booked through the
  // site (migration 007). an admin approves every review either way
  @Column({ name: 'booking_id', type: 'varchar', length: 255, nullable: true })
  bookingId: string | null;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.APPROVED })
  status: ReviewStatus;

  // when an admin approved or rejected it
  @Column({ name: 'moderated_at', type: 'datetime', nullable: true })
  moderatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Booking, (booking) => booking.reviews, { nullable: true })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking | null;

  @ManyToOne(() => Customer, (customer) => customer.reviews)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => ServiceProvider, (provider) => provider.reviews)
  @JoinColumn({ name: 'provider_id' })
  provider: ServiceProvider;
}
