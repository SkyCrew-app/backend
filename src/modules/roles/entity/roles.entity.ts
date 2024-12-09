import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToMany } from 'typeorm';
import { User } from '../../users/entity/users.entity';

@ObjectType()
@Entity('roles')
export class Role {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ unique: true })
  role_name: string;

  @Field(() => [User], { nullable: true })
  @ManyToMany(() => User, (user) => user.roles, { nullable: true })
  users?: User[];
}
