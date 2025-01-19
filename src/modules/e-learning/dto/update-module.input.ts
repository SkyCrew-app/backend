import { InputType, PartialType } from '@nestjs/graphql';
import { CreateModuleDTO } from './create-module.input';

@InputType()
export class UpdateModuleDTO extends PartialType(CreateModuleDTO) {}
