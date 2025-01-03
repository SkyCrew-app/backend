import {
  ObjectType,
  Field,
  Int,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Maintenance } from '../../maintenance/entity/maintenance.entity';

export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  RESERVATED = 'RESERVATED',
}

registerEnumType(AvailabilityStatus, {
  name: 'AvailabilityStatus',
});

@ObjectType()
@Entity('aircraft')
export class Aircraft {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ unique: true })
  registration_number: string;

  @Field()
  @Column()
  model: string;

  @Field(() => Int)
  @Column()
  year_of_manufacture: number;

  @Field(() => Int)
  @Column({ nullable: true })
  maxAltitude: number;

  @Field(() => Int)
  @Column({ nullable: true })
  cruiseSpeed: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  image_url: string;

  @Field(() => [String], { nullable: true })
  @Column('simple-array', { nullable: true })
  documents_url: string[];

  @Field(() => AvailabilityStatus)
  @Column({
    type: 'enum',
    enum: AvailabilityStatus,
    default: AvailabilityStatus.AVAILABLE,
  })
  availability_status: AvailabilityStatus;

  @Field()
  @Column({ default: 'OK' })
  maintenance_status: string;

  @Field(() => Float)
  @Column('float')
  hourly_cost: number;

  @Field(() => Float)
  @Column({ default: 0 })
  total_flight_hours: number;

  @Field(() => [Reservation])
  @OneToMany(() => Reservation, (reservation) => reservation.aircraft)
  reservations: Reservation[];

  @Field(() => [Maintenance])
  @OneToMany(() => Maintenance, (maintenance) => maintenance.aircraft)
  maintenances: Maintenance[];
}
