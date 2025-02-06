import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { InstructionCourse } from './instruction-courses.entity';

@ObjectType()
@Entity('course_comments')
export class CourseComment {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ type: 'text' })
  content: string;

  @Field()
  @Column()
  creationDate: Date;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.id)
  author: User;

  @Field(() => InstructionCourse)
  @ManyToOne(() => InstructionCourse, (course) => course.comments)
  course: InstructionCourse;
}
