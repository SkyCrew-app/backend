import { Field, ObjectType, InputType } from '@nestjs/graphql';

@ObjectType()
@InputType('TaxonomiesInput')
export class Taxonomies {
  @Field(() => [String])
  maintenanceTypes: string[];

  @Field(() => [String])
  licenseTypes: string[];

  @Field(() => [String])
  aircraftCategories: string[];

  @Field(() => [String])
  flightTypes: string[];
}

@InputType()
export class TaxonomiesInput {
  @Field(() => [String])
  maintenanceTypes: string[];

  @Field(() => [String])
  licenseTypes: string[];

  @Field(() => [String])
  aircraftCategories: string[];

  @Field(() => [String])
  flightTypes: string[];
}
