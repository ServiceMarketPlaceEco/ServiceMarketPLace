import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ServiceProvider } from './service-provider.entity';
import { Service } from '../../services/entities/service.entity';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('provider_services')
export class ProviderService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @Column({ name: 'service_id' })
  serviceId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ServiceProvider, (provider) => provider.providerServices)
  @JoinColumn({ name: 'provider_id' })
  provider: ServiceProvider;

  @ManyToOne(() => Service, (service) => service.providerServices)
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @OneToMany(() => Booking, (booking) => booking.providerService)
  bookings: Booking[];
}
