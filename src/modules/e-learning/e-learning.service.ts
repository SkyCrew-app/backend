import {
  HttpException,
  HttpStatus,
  Injectable,
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
      console.error('Database Error:', error);
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
    await this.courseRepository.delete(courseId);
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
      console.error('Database Error:', error);
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
      console.error('Database Error:', error);
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
    await this.moduleRepository.delete(moduleId);
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
    await this.lessonRepository.update(lessonId, updateLessonDto);
    return this.lessonRepository.findOne({ where: { id: lessonId } });
  }

  async deleteLesson(lessonId: number): Promise<void> {
    await this.lessonRepository.delete(lessonId);
  }

  async completeLesson(userId: number, lessonId: number): Promise<void> {
    await this.userProgressService.markLessonCompleted(userId, lessonId);
  }
}
