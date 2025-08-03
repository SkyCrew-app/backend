import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstructionCourse } from './entity/instruction-courses.entity';
import { CourseCompetency } from './entity/course-competency.entity';
import { CourseComment } from './entity/course-comment.entity';
import { InstructionCoursesService } from './instruction-courses.service';
import { InstructionCoursesResolver } from './instruction-courses.resolver';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserProgress } from '../users/entity/user-progress.entity';
import { ELearningModule } from '../e-learning/e-learning.module';
import { Lesson } from '../e-learning/entity/lesson.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstructionCourse,
      CourseCompetency,
      CourseComment,
      UserProgress,
      Lesson,
    ]),
    UsersModule,
    NotificationsModule,
    ELearningModule,
  ],
  providers: [InstructionCoursesService, InstructionCoursesResolver],
  exports: [InstructionCoursesService],
})
export class InstructionCoursesModule {}
