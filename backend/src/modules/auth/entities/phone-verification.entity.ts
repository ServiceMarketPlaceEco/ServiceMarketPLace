import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// Backs the customer signup SMS-code step. A row is created on
// POST /auth/phone-verification/request and consumed once, by
// POST /auth/register/customer, after verify sets verificationToken.
@Entity('phone_verifications')
export class PhoneVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ name: 'code_hash', length: 255 })
  codeHash: string;

  @Column({ type: 'varchar', name: 'verification_token', length: 255, nullable: true })
  verificationToken: string | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_consumed', default: false })
  isConsumed: boolean;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
