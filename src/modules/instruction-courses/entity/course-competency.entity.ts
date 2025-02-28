import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { InstructionCourse } from './instruction-courses.entity';

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

  @Field(() => InstructionCourse)
  @ManyToOne(() => InstructionCourse, (course) => course.competencies)
  course: InstructionCourse;
}
