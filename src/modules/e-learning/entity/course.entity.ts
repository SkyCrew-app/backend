import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Module } from './module.entity';
import { LicenseType } from '../../../shared/enums/licence-type.enum';

@ObjectType()
@Entity('courses')
export class Course {
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

  @Column({ nullable: true })
  @Field(() => String, { nullable: true })
  category: string;

  @Field(() => [Module])
  @OneToMany(() => Module, (module) => module.course)
  modules: Module[];

  @Field(() => LicenseType, { description: 'Required license for this course' })
  @Column({ type: 'enum', enum: LicenseType, nullable: true })
  required_license?: LicenseType;
}
