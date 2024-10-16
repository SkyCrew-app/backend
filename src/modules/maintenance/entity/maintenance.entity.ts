import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import { MaintenanceType } from './maintenance-type.enum';

@ObjectType()
@Entity('maintenance')
export class Maintenance {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.maintenances)
  aircraft: Aircraft;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, (user) => user.maintenances, { nullable: true })
  technician: User;

  @Field()
  @Column()
  start_date: Date;

  @Field()
  @Column()
  end_date: Date;

  @Field(() => MaintenanceType, { nullable: true })
  @Column({ type: 'enum', enum: MaintenanceType, nullable: true })
  maintenance_type: MaintenanceType;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  parts_changed: string;

  @Field(() => Float, { nullable: true })
  @Column('float', { nullable: true })
  maintenance_cost: number;

  @Field(() => [String], { nullable: true })
  @Column('simple-array', { nullable: true })
  images_url: string[];

  @Field(() => [String], { nullable: true })
  @Column('simple-array', { nullable: true })
  documents_url: string[];
}
