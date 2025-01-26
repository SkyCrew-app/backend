import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Taxonomies } from '../types/taxonomies';

@Entity('admin')
@ObjectType()
export class Administration {
  @PrimaryGeneratedColumn()
  @Field(() => Int)
  id: number;

  @Field()
  @Column({ length: 255 })
  clubName: string;

  @Field()
  @Column({ length: 255 })
  contactEmail: string;

  @Field()
  @Column({ length: 15 })
  contactPhone: string;

  @Field()
  @Column('text')
  address: string;

  @Field(() => [String], { nullable: true })
  @Column('text', { array: true })
  closureDays: string[];

  @Field(() => Int)
  @Column('integer')
  timeSlotDuration: number;

  @Field()
  @Column({ type: 'time' })
  reservationStartTime: string;

  @Field()
  @Column({ type: 'time' })
  reservationEndTime: string;

  @Field({ nullable: true })
  @Column({ length: 255 })
  maintenanceDay: string;

  @Field(() => Int, { nullable: true })
  @Column('integer')
  maintenanceDuration: number;

  @Field(() => [String], { nullable: true })
  @Column('text', { array: true })
  pilotLicenses: string[];

  @Field(() => Float, { nullable: true })
  @Column('float')
  membershipFee: number;

  @Field(() => Float, { nullable: true })
  @Column('float')
  flightHourRate: number;

  @Field()
  @Column('text', { nullable: true })
  clubRules: string;

  @Field()
  @Column('boolean')
  allowGuestPilots: boolean;

  @Field(() => Float, { nullable: true })
  @Column('float', { nullable: true })
  guestPilotFee: number;

  @Field()
  @Column({ type: 'enum', enum: ['self-service', 'staff-only', 'external'] })
  fuelManagement: 'self-service' | 'staff-only' | 'external';

  @Field()
  @Column({ type: 'boolean', nullable: false, default: false })
  isMaintenanceActive: boolean;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  maintenanceMessage: string;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  maintenanceTime: Date;

  @Field(() => Taxonomies)
  @Column('jsonb', { nullable: true })
  taxonomies: Taxonomies;
}
