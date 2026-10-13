import { Field, Int, ObjectType } from '@nestjs/graphql';

// What happened to a template an administrator asked to delete.
@ObjectType()
export class ChecklistTemplateRemoval {
  @Field(() => Boolean)
  deleted: boolean;

  // True when the template was kept and only taken out of use, because
  // checklists already filled in refer to it.
  @Field(() => Boolean)
  deactivated: boolean;

  @Field(() => Int)
  submissions_count: number;

  @Field()
  message: string;
}
