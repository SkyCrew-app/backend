import { registerEnumType } from '@nestjs/graphql';

export enum DifficultyLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

registerEnumType(DifficultyLevel, {
  name: 'DifficultyLevel',
});
