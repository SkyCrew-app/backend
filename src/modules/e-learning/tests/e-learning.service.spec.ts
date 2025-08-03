import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ELearningService } from '../e-learning.service';
import { Course } from '../entity/course.entity';
import { Module } from '../entity/module.entity';
import { Lesson } from '../entity/lesson.entity';
import { UsersService } from '../../users/users.service';
import { NotFoundException, HttpException } from '@nestjs/common';

describe('ELearningService', () => {
  let service: ELearningService;
  let courseRepo: Partial<Record<keyof Repository<Course>, jest.Mock>>;
  let moduleRepo: Partial<Record<keyof Repository<Module>, jest.Mock>>;
  let lessonRepo: Partial<Record<keyof Repository<Lesson>, jest.Mock>>;
  let userProgressService: Partial<UsersService>;

  beforeEach(async () => {
    courseRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    moduleRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    lessonRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    userProgressService = {
      getCourseProgress: jest.fn(),
      markLessonStarted: jest.fn(),
      markLessonCompleted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ELearningService,
        { provide: getRepositoryToken(Course), useValue: courseRepo },
        { provide: getRepositoryToken(Module), useValue: moduleRepo },
        { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
        { provide: UsersService, useValue: userProgressService },
      ],
    }).compile();

    service = module.get<ELearningService>(ELearningService);
  });

  describe('getCourses', () => {
    it('applies filters and returns courses with progress', async () => {
      const qb: Partial<SelectQueryBuilder<Course>> = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1 }] as any),
      };
      (courseRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      (userProgressService.getCourseProgress as jest.Mock).mockResolvedValue(
        50,
      );

      const result = await service.getCourses('cat', 'lic', 'search', 2);
      expect(qb.andWhere).toHaveBeenCalled();
      expect(result[0]['progress']).toBe(50);
    });
  });

  describe('getCourseById', () => {
    it('returns course with progress when userId provided', async () => {
      const course = { id: 1 } as any;
      (courseRepo.findOne as jest.Mock).mockResolvedValue(course);
      (userProgressService.getCourseProgress as jest.Mock).mockResolvedValue(
        75,
      );

      const res = await service.getCourseById(1, 3);
      expect(res['progress']).toBe(75);
    });

    it('returns course without progress when no userId', async () => {
      const course = { id: 2 } as any;
      (courseRepo.findOne as jest.Mock).mockResolvedValue(course);

      const res = await service.getCourseById(2);
      expect(res.id).toBe(2);
    });
  });

  describe('createCourse', () => {
    it('saves and returns a new course', async () => {
      const dto = { title: 'Test', required_license: null } as any;
      const created = { id: 1, title: 'Test' } as any;
      (courseRepo.create as jest.Mock).mockReturnValue(created);
      (courseRepo.save as jest.Mock).mockResolvedValue(created);

      const res = await service.createCourse(dto);
      expect(courseRepo.create).toHaveBeenCalledWith({
        ...dto,
        required_license: null,
      });
      expect(courseRepo.save).toHaveBeenCalledWith(created);
      expect(res).toBe(created);
    });

    it('throws HttpException on database error', async () => {
      const error = new Error('fail');
      (courseRepo.create as jest.Mock).mockImplementation(() => {
        throw error;
      });
      await expect(service.createCourse({ title: '' } as any)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateCourse', () => {
    it('updates and retrieves the course', async () => {
      const updated = { id: 3, title: 'Updated' } as any;
      (courseRepo.update as jest.Mock).mockResolvedValue(undefined);
      (courseRepo.findOne as jest.Mock).mockResolvedValue(updated);

      const res = await service.updateCourse(3, { title: 'Updated' } as any);
      expect(courseRepo.update).toHaveBeenCalledWith(3, { title: 'Updated' });
      expect(res).toBe(updated);
    });
  });

  describe('getModulesByCourse', () => {
    it('returns modules for the given course', async () => {
      const modules = [{ id: 4 }] as any;
      (moduleRepo.find as jest.Mock).mockResolvedValue(modules);

      const res = await service.getModulesByCourse(10);
      expect(res).toBe(modules);
    });
  });

  describe('createLesson', () => {
    it('creates and returns a new lesson', async () => {
      const moduleEntity = { id: 5, lessons: [] } as any;
      const lessonEntity = { id: 6, module: moduleEntity } as any;
      (moduleRepo.findOne as jest.Mock).mockResolvedValue(moduleEntity);
      (lessonRepo.create as jest.Mock).mockReturnValue({} as any);
      (lessonRepo.save as jest.Mock).mockResolvedValue(lessonEntity);
      (lessonRepo.findOne as jest.Mock).mockResolvedValue(lessonEntity);

      const res = await service.createLesson({
        moduleId: 5,
        title: 'L',
        content: {},
      } as any);
      expect(res).toBe(lessonEntity);
    });

    it('throws NotFoundException if module does not exist', async () => {
      (moduleRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.createLesson({ moduleId: 99 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
