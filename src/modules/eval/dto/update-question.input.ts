import { InputType, PartialType } from '@nestjs/graphql';
import { CreateQuestionDTO } from './create-question.input';

@InputType()
export class UpdateQuestionDTO extends PartialType(CreateQuestionDTO) {}
