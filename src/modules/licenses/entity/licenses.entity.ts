import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';

// One licence number per licence type. Created by a migration, which skips
// it when existing rows already collide.
export const LICENCE_NUMBER_UNIQUE_INDEX = 'UQ_licenses_type_number';

@ObjectType()
@Entity('licenses')
@Index(LICENCE_NUMBER_UNIQUE_INDEX, { synchronize: false })
export class License {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.licenses, { eager: true })
  user: User;

  @Field()
  @Column()
  license_type: string;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  issue_date?: Date;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  expiration_date?: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  certification_authority?: string;

  @Field(() => Boolean)
  @Column({ default: true })
  is_valid: boolean;

  @Field({ defaultValue: 'active' })
  @Column({ default: 'active' })
  status: 'active' | 'expired' | 'pending';

  @Field({ nullable: true })
  @Column({ nullable: true })
  license_number: string;

  @Field(() => [String], { nullable: true })
  @Column('simple-array', { nullable: true })
  documents_url?: string[];

  // Expiry reminders already sent: the tightest step (in days) and the
  // expiry date it was sent for. A renewed licence starts again. Never part
  // of the API.
  @Column({ type: 'int', nullable: true })
  expiry_reminder_days: number | null;

  @Column({ type: 'timestamp', nullable: true })
  expiry_reminder_for: Date | null;
}
