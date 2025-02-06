import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstructionCourse } from './entity/instruction-courses.entity';
import { CourseCompetency } from './entity/course-competency.entity';
import { CourseComment } from './entity/course-comment.entity';
import { InstructionCoursesService } from './instruction-courses.service';
import { InstructionCoursesResolver } from './instruction-courses.resolver';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstructionCourse,
      CourseCompetency,
      CourseComment,
    ]),
    UsersModule,
  ],
  providers: [InstructionCoursesService, InstructionCoursesResolver],
  exports: [InstructionCoursesService],
})
export class InstructionCoursesModule {}
