import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Column,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@ObjectType()
@Entity()
export class Article {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  title: string;

  @Field()
  @Column()
  description: string;

  @Field()
  @Column({ type: 'text' })
  text: string;

  @Field(() => [String])
  @Column('simple-array')
  tags: string[];

  @Field({ nullable: true })
  @Column({ nullable: true })
  photo_url?: string;

  @Field(() => [String], { nullable: true })
  @Column('simple-array', { nullable: true })
  documents_url?: string[];

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  eventDate?: Date;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field({ nullable: true })
  calendarLink?: string;
}
