import { InputType, Field } from '@nestjs/graphql';
import { LicenseType } from '../../../shared/enums/licence-type.enum';

@InputType()
export class CreateCourseDTO {
  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  category?: string;

  @Field(() => LicenseType, {
    nullable: true,
    name: 'required_license',
  })
  required_license?: LicenseType;
}
