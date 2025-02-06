import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { CourseStatus } from '../enum/course-status.enum';
import { CourseComment } from './course-comment.entity';
import { CourseCompetency } from './course-competency.entity';

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
  @Column({ type: 'timestamp' })
  startTime: Date;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  endTime?: Date;

  @Field(() => CourseStatus)
  @Column({
    type: 'enum',
    enum: CourseStatus,
    default: CourseStatus.SCHEDULED,
  })
  status: CourseStatus;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  feedback?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  rating?: number;

  @Field(() => [CourseCompetency], { nullable: true })
  @OneToMany(() => CourseCompetency, (competency) => competency.course, {
    cascade: true,
    eager: true,
  })
  competencies?: CourseCompetency[];

  @Field(() => [CourseComment], { nullable: true })
  @OneToMany(() => CourseComment, (comment) => comment.course, {
    cascade: true,
    eager: true,
  })
  comments?: CourseComment[];
}
