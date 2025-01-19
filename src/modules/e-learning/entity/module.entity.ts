import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Course } from './course.entity';
import { Lesson } from './lesson.entity';
import { Evaluation } from '../../eval/entity/evaluation.entity';

@ObjectType()
@Entity('modules')
export class Module {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  title: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Field(() => Course)
  @ManyToOne(() => Course, (course) => course.modules, { onDelete: 'CASCADE' })
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
