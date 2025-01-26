import { InputType, PartialType } from '@nestjs/graphql';
import { CreateCourseDTO } from './create-course.input';

@InputType()
export class UpdateCourseDTO extends PartialType(CreateCourseDTO) {}
