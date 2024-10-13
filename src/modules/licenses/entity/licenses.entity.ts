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
  @ManyToOne(() => User, (user) => user.licenses)
  user: User;

  @Field()
  @Column()
  license_type: string;

  @Field()
  @Column()
  expiration_date: Date;

  @Field()
  @Column()
  issue_date: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  certification_authority: string;

  @Field(() => Boolean)
  @Column({ default: true })
  is_valid: boolean;
}
