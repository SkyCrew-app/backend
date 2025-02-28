import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';

@ObjectType()
@Entity('expenses')
export class Expense {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Date)
  @Column({ type: 'timestamp' })
  expense_date: Date;

  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Field()
  @Column()
  category: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  sub_category?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  // Optionnel – Si la dépense concerne un coût d’exploitation lié à un avion,
  // on peut enregistrer la relation sans modifier l'entité Aircraft (relation unidirectionnelle)
  @Field(() => Aircraft, { nullable: true })
  @ManyToOne(() => Aircraft, { nullable: true })
  aircraft?: Aircraft;
}
