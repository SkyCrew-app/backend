import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InstructionCoursesService } from '../instruction-courses/instruction-courses.service';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly courseService: InstructionCoursesService) {}

  @Cron('0 0 * * *')
  async handleCourseStatusUpdate() {
    console.log('Vérification quotidienne des statuts des cours...');
    try {
      const expiredCourses = await this.courseService.findExpiredCourses();
      for (const course of expiredCourses) {
        await this.courseService.updateCourseStatus(
          course.id,
          'COMPLETED' as unknown as InstructionCourse['status'],
        );
        this.logger.log(
          `Statut du cours ${course.id} mis à jour en "completed"`,
        );
      }
    } catch (error) {
      console.log('Erreur lors de la mise à jour des statuts des cours', error);
    }
  }
}
