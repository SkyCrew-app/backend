import { InputType, PartialType } from '@nestjs/graphql';
import { CreateLessonDTO } from './create-lesson.input';

@InputType()
export class UpdateLessonDTO extends PartialType(CreateLessonDTO) {}
