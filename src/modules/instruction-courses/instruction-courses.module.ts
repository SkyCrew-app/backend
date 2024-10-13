import { Module } from '@nestjs/common';
import { InstructionCoursesService } from './instruction-courses.service';
import { InstructionCoursesResolver } from './instruction-courses.resolver';

@Module({
  providers: [InstructionCoursesService, InstructionCoursesResolver]
})
export class InstructionCoursesModule {}
