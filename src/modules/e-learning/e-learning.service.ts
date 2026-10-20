import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entity/course.entity';
import { Module } from './entity/module.entity';
import { Lesson } from './entity/lesson.entity';
import { UsersService } from '../users/users.service';
import { CreateCourseDTO } from './dto/create-course.input';
import { UpdateCourseDTO } from './dto/update-course.input';
import { CreateModuleDTO } from './dto/create-module.input';
import { UpdateModuleDTO } from './dto/update-module.input';
import { CreateLessonDTO } from './dto/create-lesson.input';
import { UpdateLessonDTO } from './dto/update-lesson.input';
import { sanitizeLessonContent } from '../../common/html/sanitize-rich-text';
import { localized } from '../../common/i18n/localized-exception';

type ContentScope = 'course' | 'module' | 'lesson';

// The lessons and evaluations under a course, a module or a lesson.
const SCOPE_SQL: Record<
  ContentScope,
  { lessons: string; evaluations: string }
> = {
  course: {
    lessons: `SELECT l.id FROM lessons l JOIN modules m ON m.id = l."moduleId" WHERE m.course_id = $1`,
    evaluations: `SELECT e.id FROM evaluations e JOIN modules m ON m.id = e."moduleId" WHERE m.course_id = $1`,
  },
  module: {
    lessons: `SELECT l.id FROM lessons l WHERE l."moduleId" = $1`,
    evaluations: `SELECT e.id FROM evaluations e WHERE e."moduleId" = $1`,
  },
  lesson: {
    lessons: `SELECT $1::integer AS id`,
    evaluations: `SELECT NULL::integer AS id WHERE false`,
  },
};

@Injectable()
export class ELearningService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly userProgressService: UsersService,
  ) {}

  // Gestion des cours
  async getCourses(
    category?: string,
    license?: string,
    search?: string,
    userId?: number,
  ): Promise<Course[]> {
    const query = this.courseRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.modules', 'modules')
      .leftJoinAndSelect('modules.lessons', 'lessons');

    if (category) query.andWhere('course.category = :category', { category });
    if (license)
      query.andWhere('course.required_license = :license', { license });
    if (search)
      query.andWhere('course.title ILIKE :search', { search: `%${search}%` });

    const courses = await query.getMany();

    if (userId) {
      for (const course of courses) {
        course['progress'] = await this.userProgressService.getCourseProgress(
          userId,
          course.id,
        );
      }
    }

    return courses;
  }

  async getCourseById(courseId: number, userId?: number): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
      relations: ['modules', 'modules.lessons', 'modules.evaluations'],
      // The reading order of a course: modules and lessons as they were added.
      order: { modules: { id: 'ASC', lessons: { id: 'ASC' } } },
    });

    if (userId) {
      course['progress'] = await this.userProgressService.getCourseProgress(
        userId,
        courseId,
      );
    }

    return course;
  }

  async createCourse(createCourseDto: CreateCourseDTO): Promise<Course> {
    try {
      const course = this.courseRepository.create({
        ...createCourseDto,
        required_license: createCourseDto.required_license || null,
      });

      await this.courseRepository.save(course);
      return course;
    } catch (error) {
      new Logger(ELearningService.name).error('Database Error', error);
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          details: error.driverError?.detail || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async updateCourse(
    courseId: number,
    updateCourseDto: UpdateCourseDTO,
  ): Promise<Course> {
    await this.courseRepository.update(courseId, updateCourseDto);
    return this.getCourseById(courseId);
  }

  async deleteCourse(courseId: number): Promise<void> {
    await this.deleteContent('course', courseId);
  }

  // Evaluation results are part of a member's training record: content
  // with results is never deleted. Lesson progress (started, read) goes
  // with its lessons.
  private async deleteContent(scope: ContentScope, id: number): Promise<void> {
    const sql = SCOPE_SQL[scope];
    await this.courseRepository.manager.transaction(async (manager) => {
      const results: unknown[] = await manager.query(
        `SELECT 1 FROM user_progress WHERE "evaluationId" IN (${sql.evaluations}) LIMIT 1`,
        [id],
      );
      if (results.length > 0)
        throw localized(ConflictException, 'error.elearning.hasResults');
      await manager.query(
        `DELETE FROM user_progress WHERE "lessonId" IN (${sql.lessons})`,
        [id],
      );
      const repository =
        scope === 'course'
          ? manager.getRepository(Course)
          : scope === 'module'
            ? manager.getRepository(Module)
            : manager.getRepository(Lesson);
      await repository.delete(id);
    });
  }

  // Gestion des modules
  async getModulesByCourse(courseId: number): Promise<Module[]> {
    return this.moduleRepository.find({
      where: { course: { id: courseId } },
      relations: ['lessons'],
    });
  }

  async getAllModules(): Promise<Module[]> {
    const modules = await this.moduleRepository.find();
    return modules;
  }

  async createModule(createModuleDto: CreateModuleDTO): Promise<Module> {
    try {
      const module = this.moduleRepository.create(createModuleDto);

      await this.moduleRepository.save(module);
      return this.moduleRepository.findOne({
        where: { id: module.id },
        relations: ['course'],
      });
    } catch (error) {
      new Logger(ELearningService.name).error('Database Error', error);
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          details: error.driverError?.detail || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async updateModule(
    moduleId: number,
    updateModuleDto: UpdateModuleDTO,
  ): Promise<Module> {
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
      relations: ['course'],
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    try {
      Object.assign(module, updateModuleDto);
      return await this.moduleRepository.save(module);
    } catch (error) {
      new Logger(ELearningService.name).error('Database Error', error);
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Update failed',
          details: error.driverError?.detail || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async deleteModule(moduleId: number): Promise<void> {
    await this.deleteContent('module', moduleId);
  }

  // Gestion des leçons
  async getLessonContent(lessonId: number, userId: number): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
    });
    await this.userProgressService.markLessonStarted(userId, lessonId);
    return lesson;
  }

  async getLessonsByModule(moduleId: number): Promise<Lesson[]> {
    return this.lessonRepository.find({
      where: { module: { id: moduleId } },
    });
  }

  async createLesson(createLessonDto: CreateLessonDTO): Promise<Lesson> {
    const module = await this.moduleRepository.findOne({
      where: { id: createLessonDto.moduleId },
      relations: ['lessons'],
    });

    if (!module) {
      throw new NotFoundException(
        `Module with ID ${createLessonDto.moduleId} not found`,
      );
    }

    const lesson = this.lessonRepository.create({
      ...createLessonDto,
      content: sanitizeLessonContent(createLessonDto.content),
      module,
    });

    await this.lessonRepository.save(lesson);

    return this.lessonRepository.findOne({
      where: { id: lesson.id },
      relations: ['module'],
    });
  }

  async updateLesson(
    lessonId: number,
    updateLessonDto: UpdateLessonDTO,
  ): Promise<Lesson> {
    await this.lessonRepository.update(lessonId, {
      ...updateLessonDto,
      ...(updateLessonDto.content !== undefined
        ? { content: sanitizeLessonContent(updateLessonDto.content) }
        : {}),
    });
    return this.lessonRepository.findOne({ where: { id: lessonId } });
  }

  async deleteLesson(lessonId: number): Promise<void> {
    await this.deleteContent('lesson', lessonId);
  }

  async completeLesson(userId: number, lessonId: number): Promise<void> {
    await this.userProgressService.markLessonCompleted(userId, lessonId);
  }
}
