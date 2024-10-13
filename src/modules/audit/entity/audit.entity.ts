import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';

@ObjectType()
@Entity('audits')
export class Audit {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.id)
  aircraft: Aircraft;

  @Field()
  @Column()
  audit_date: Date;

  @Field()
  @Column()
  audit_result: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  corrective_actions?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  next_audit_date?: Date;

  @Field()
  @Column()
  audit_frequency: string;
}
