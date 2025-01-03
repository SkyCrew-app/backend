import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entity/users.entity';

@ObjectType()
@Entity('licenses')
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
}
