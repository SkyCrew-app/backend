import { registerEnumType } from '@nestjs/graphql';

export enum CourseStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

registerEnumType(CourseStatus, {
  name: 'CourseStatus',
});
