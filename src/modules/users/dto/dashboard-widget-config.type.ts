import { ObjectType, Field, Int, InputType } from '@nestjs/graphql';

@ObjectType()
export class DashboardWidgetConfig {
  @Field()
  widgetId: string;

  @Field()
  visible: boolean;

  @Field(() => Int)
  order: number;

  @Field()
  size: string;
}

@InputType()
export class DashboardWidgetConfigInput {
  @Field()
  widgetId: string;

  @Field()
  visible: boolean;

  @Field(() => Int)
  order: number;

  @Field()
  size: string;
}
