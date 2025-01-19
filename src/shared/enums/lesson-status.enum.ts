import { registerEnumType } from '@nestjs/graphql';

export enum LessonStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

registerEnumType(LessonStatus, {
  name: 'LessonStatus',
});
