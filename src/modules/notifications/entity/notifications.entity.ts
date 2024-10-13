import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entity/users.entity';

@ObjectType()
@Entity('notifications')
export class Notification {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @Field()
  @Column()
  notification_type: string;

  @Field()
  @Column()
  message: string;

  @Field()
  @Column()
  notification_date: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  expiration_date: Date;

  @Field(() => Boolean)
  @Column({ default: false })
  is_read: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  action_url: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  priority: string;
}
