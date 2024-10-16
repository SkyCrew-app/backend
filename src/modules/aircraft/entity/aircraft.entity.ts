import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Maintenance } from '../../maintenance/entity/maintenance.entity';

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

  @Field({ nullable: true })
  @Column({ nullable: true })
  image_url: string;

  @Field(() => [String], { nullable: true })
  @Column('simple-array', { nullable: true })
  documents_url: string[];

  @Field()
  @Column({ default: 'available' })
  availability_status: string;

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
