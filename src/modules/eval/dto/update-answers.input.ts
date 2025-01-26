import { InputType, PartialType } from '@nestjs/graphql';
import { CreateAnswerDTO } from './create-answer.input';

@InputType()
export class UpdateAnswerDTO extends PartialType(CreateAnswerDTO) {}
