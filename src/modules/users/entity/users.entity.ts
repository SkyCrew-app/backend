import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Maintenance } from '../../maintenance/entity/maintenance.entity';
import { License } from '../../licenses/entity/licenses.entity';
import { Invoice } from '../../invoices/entity/invoices.entity';
import { Role } from '../../roles/entity/roles.entity';

@ObjectType()
@Entity('users')
export class User {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  first_name: string;

  @Field()
  @Column()
  last_name: string;

  @Field()
  @Column({ unique: true })
  email: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  password: string;

  @Field(() => Boolean)
  @Column({ default: false })
  is2FAEnabled: boolean;

  @Field(() => Boolean)
  @Column({ default: false })
  isEmailConfirmed: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  twoFactorAuthSecret: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  phone_number: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  address: string;

  @Field({ nullable: false })
  @Column()
  date_of_birth: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  profile_picture: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  total_flight_hours: number;

  @Field(() => Boolean)
  @Column({ default: true })
  email_notifications_enabled: boolean;

  @Field(() => Boolean)
  @Column({ default: false })
  sms_notifications_enabled: boolean;

  @Field(() => Boolean)
  @Column({ default: true })
  newsletter_subscribed: boolean;

  @Field(() => [Role])
  @OneToMany(() => Role, (role) => role.users)
  roles: Role[];

  @Field(() => [Reservation])
  @OneToMany(() => Reservation, (reservation) => reservation.user)
  reservations: Reservation[];

  @Field(() => [Maintenance], { nullable: true })
  @OneToMany(() => Maintenance, (maintenance) => maintenance.technician)
  maintenances: Maintenance[];

  @Field(() => [License])
  @OneToMany(() => License, (license) => license.user)
  licenses: License[];

  @Field(() => [Invoice])
  @OneToMany(() => Invoice, (invoice) => invoice.user)
  invoices: Invoice[];
}
