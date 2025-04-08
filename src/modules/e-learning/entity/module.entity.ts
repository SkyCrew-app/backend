import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { Lesson } from './lesson.entity';
import { Evaluation } from '../../eval/entity/evaluation.entity';

@ObjectType()
@Entity('modules')
export class Module {
  @Field(() => Int)
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Field()
  @Column()
  title: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Column({ name: 'course_id' })
  @Field(() => Int)
  courseId: number;

  @Field(() => Course)
  @ManyToOne(() => Course, (course) => course.modules, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Field(() => [Lesson])
  @OneToMany(() => Lesson, (lesson) => lesson.module)
  lessons: Lesson[];

  @Field(() => [Evaluation], { description: 'Evaluations for the module' })
  @OneToMany(() => Evaluation, (evaluation) => evaluation.module, {
    cascade: true,
  })
  evaluations: Evaluation[];
}
