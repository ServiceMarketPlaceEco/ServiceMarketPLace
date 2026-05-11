import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProviderService } from '../../providers/entities/provider-service.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid', { name: 'service_id' })
  serviceId: string;

  @Column({ name: 'service_name', length: 255 })
  serviceName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true, length: 100 })
  icon: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => ProviderService, (ps) => ps.service)
  providerServices: ProviderService[];
}
