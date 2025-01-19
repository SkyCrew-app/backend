import { registerEnumType } from '@nestjs/graphql';

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  OPEN_ENDED = 'OPEN_ENDED',
}

registerEnumType(QuestionType, {
  name: 'QuestionType',
});
