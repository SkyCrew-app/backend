import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { InstructionCourse } from './instruction-courses.entity';
import { User } from '../../users/entity/users.entity';

@ObjectType()
@Entity('course_competencies')
export class CourseCompetency {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field({ nullable: true })
  @Column({ type: 'boolean', default: false })
  validated?: boolean;

  // Who validated the competency and when: part of the training record.
  // Empty on competencies validated before these columns existed.
  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true, eager: true })
  validatedBy?: User | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  validatedAt?: Date | null;

  @Field(() => InstructionCourse)
  @ManyToOne(() => InstructionCourse, (course) => course.competencies)
  course: InstructionCourse;
}
