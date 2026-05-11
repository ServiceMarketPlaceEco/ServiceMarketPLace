import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Admin } from '../../admins/entities/admin.entity';

export enum ReporterType {
  CUSTOMER = 'customer',
  PROVIDER = 'provider',
  ADMIN = 'admin',
}

export enum ReportedType {
  CUSTOMER = 'customer',
  PROVIDER = 'provider',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('block_reports')
export class BlockReport {
  @PrimaryGeneratedColumn('uuid', { name: 'report_id' })
  reportId: string;

  @Column({ name: 'reporter_id' })
  reporterId: string;

  @Column({
    name: 'reporter_type',
    type: 'enum',
    enum: ReporterType,
  })
  reporterType: ReporterType;

  @Column({ name: 'reported_id' })
  reportedId: string;

  @Column({
    name: 'reported_type',
    type: 'enum',
    enum: ReportedType,
  })
  reportedType: ReportedType;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Admin, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolvedByAdmin: Admin;
}
