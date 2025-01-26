import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ELearningService } from './e-learning.service';
import { Course } from './entity/course.entity';
import { Module as CourseModule } from './entity/module.entity';
import { Lesson } from './entity/lesson.entity';
import {
  CourseResolver,
  ModuleResolver,
  LessonResolver,
} from './e-learning.resolver';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, CourseModule, Lesson]),
    UsersModule,
  ],
  providers: [ELearningService, CourseResolver, ModuleResolver, LessonResolver],
  exports: [ELearningService],
})
export class ELearningModule {}
