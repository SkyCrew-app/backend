import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entity/users.entity';

@ObjectType()
@Entity('instruction_courses')
export class InstructionCourse {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.id)
  instructor: User;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.id)
  student: User;

  @Field()
  @Column()
  course_date: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  feedback: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  skills_taught: string;

  @Field()
  @Column()
  course_level: string;
}
