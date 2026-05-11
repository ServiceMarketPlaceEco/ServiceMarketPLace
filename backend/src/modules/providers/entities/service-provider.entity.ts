import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ProviderService } from './provider-service.entity';
import { Review } from '../../reviews/entities/review.entity';

@Entity('service_providers')
export class ServiceProvider {
  @PrimaryGeneratedColumn('uuid', { name: 'provider_id' })
  providerId: string;

  @Column({ name: 'provider_name', length: 255 })
  providerName: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  @Exclude()
  passwordHash: string;

  @Column({ name: 'ABN', nullable: true })
  abn: number;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'postal_code', nullable: true })
  postalCode: number;

  @Column({ nullable: true })
  phone: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'profile_image', nullable: true, length: 500 })
  profileImage: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ name: 'total_reviews', default: 0 })
  totalReviews: number;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_blocked', default: false })
  isBlocked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => ProviderService, (ps) => ps.provider)
  providerServices: ProviderService[];

  @OneToMany(() => Review, (review) => review.provider)
  reviews: Review[];
}
