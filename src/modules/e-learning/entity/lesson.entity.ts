import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Module } from './module.entity';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
@Entity('lessons')
export class Lesson {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  title: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Field(() => GraphQLJSON, { description: 'Rich content in JSON format' })
  @Column('jsonb')
  content: any;

  @Field({ nullable: true })
  @Column({ nullable: true })
  video_url: string;

  @Field(() => Module)
  @ManyToOne(() => Module, (module) => module.lessons, { onDelete: 'CASCADE' })
  module: Module;
}
