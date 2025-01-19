import { InputType, PartialType } from '@nestjs/graphql';
import { CreateEvaluationDTO } from './create-evaluation.input';

@InputType()
export class UpdateEvaluationDTO extends PartialType(CreateEvaluationDTO) {}
