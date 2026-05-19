import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstructionCoursesService } from '../instruction-courses.service';
import { InstructionCourse } from '../entity/instruction-courses.entity';
import { CourseCompetency } from '../entity/course-competency.entity';
import { CourseComment } from '../entity/course-comment.entity';
import { UserProgress } from '../../users/entity/user-progress.entity';
import { Lesson } from '../../e-learning/entity/lesson.entity';
import { UsersService } from '../../users/users.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ELearningService } from '../../e-learning/e-learning.service';
import { NotFoundException } from '@nestjs/common';

describe('InstructionCoursesService', () => {
  let service: InstructionCoursesService;
  let courseRepo: Partial<
    Record<keyof Repository<InstructionCourse>, jest.Mock>
  >;
  let competencyRepo: Partial<
    Record<keyof Repository<CourseCompetency>, jest.Mock>
  >;
  let commentRepo: Partial<Record<keyof Repository<CourseComment>, jest.Mock>>;
  let userProgressRepo: Partial<
    Record<keyof Repository<UserProgress>, jest.Mock>
  >;
  let lessonRepo: Partial<Record<keyof Repository<Lesson>, jest.Mock>>;
  let userService: Partial<UsersService>;
  let notifications: Partial<NotificationsService>;
  let eLearningService: Partial<ELearningService>;

  beforeEach(async () => {
    courseRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    competencyRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    commentRepo = { create: jest.fn(), save: jest.fn() };
    userProgressRepo = { count: jest.fn(), findOne: jest.fn() };
    lessonRepo = { count: jest.fn() };
    userService = { findOneById: jest.fn(), getEvaluationResults: jest.fn() };
    notifications = { create: jest.fn() };
    eLearningService = { getCourses: jest.fn(), getCourseById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstructionCoursesService,
        {
          provide: getRepositoryToken(InstructionCourse),
          useValue: courseRepo,
        },
        {
          provide: getRepositoryToken(CourseCompetency),
          useValue: competencyRepo,
        },
        { provide: getRepositoryToken(CourseComment), useValue: commentRepo },
        {
          provide: getRepositoryToken(UserProgress),
          useValue: userProgressRepo,
        },
        { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
        { provide: UsersService, useValue: userService },
        { provide: NotificationsService, useValue: notifications },
        { provide: ELearningService, useValue: eLearningService },
      ],
    }).compile();

    service = module.get<InstructionCoursesService>(InstructionCoursesService);
  });

  describe('checkScheduleConflict', () => {
    it('returns true when conflict exists', async () => {
      (courseRepo.findOne as jest.Mock).mockResolvedValue({} as any);
      expect(
        await service.checkScheduleConflict(1, 2, new Date(), new Date()),
      ).toBe(true);
    });
    it('returns false when no conflict', async () => {
      (courseRepo.findOne as jest.Mock).mockResolvedValue(undefined);
      expect(
        await service.checkScheduleConflict(1, 2, new Date(), new Date()),
      ).toBe(false);
    });
  });

  describe('createCourse', () => {
    it('throws on conflict', async () => {
      jest.spyOn(service, 'checkScheduleConflict').mockResolvedValue(true);
      await expect(
        service.createCourse({
          instructorId: 1,
          studentId: 2,
          startTime: new Date(),
          endTime: new Date(),
        } as any),
      ).rejects.toThrow('Schedule conflict detected');
    });
    it('creates course and notifies both users', async () => {
      jest.spyOn(service, 'checkScheduleConflict').mockResolvedValue(false);
      (userService.findOneById as jest.Mock)
        .mockResolvedValueOnce({
          id: 1,
          first_name: 'A',
          last_name: 'B',
          profile_picture: 'pic',
        })
        .mockResolvedValueOnce({ id: 2 });
      const course = { id: 5 } as any;
      (courseRepo.create as jest.Mock).mockReturnValue(course);
      (courseRepo.save as jest.Mock).mockResolvedValue(course);

      const res = await service.createCourse({
        instructorId: 1,
        studentId: 2,
        startTime: new Date(),
        endTime: new Date(),
      } as any);
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(res).toBe(course);
    });
  });

  describe('find methods', () => {
    it('findAll returns list', async () => {
      const arr = [{ id: 1 }];
      (courseRepo.find as jest.Mock).mockResolvedValue(arr as any);
      expect(await service.findAll()).toBe(arr);
    });
    it('findCoursesByStudent calls repo with student filter', async () => {
      await service.findCoursesByStudent(10);
      expect(courseRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { student: { id: 10 } } }),
      );
    });
    it('findCoursesByInstructor calls repo with instructor filter', async () => {
      await service.findCoursesByInstructor(20);
      expect(courseRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { instructor: { id: 20 } } }),
      );
    });
  });

  describe('single course operations', () => {
    it('findOne throws if not found', async () => {
      (courseRepo.findOne as jest.Mock).mockResolvedValue(undefined);
      await expect(service.findOne(3)).rejects.toThrow(NotFoundException);
    });
    it('updateCourse updates and returns', async () => {
      const course = { id: 3, rating: 0 } as any;
      jest.spyOn(service, 'findOne').mockResolvedValue(course);
      (courseRepo.save as jest.Mock).mockResolvedValue({
        ...course,
        rating: 4,
        feedback: 'ok',
      });
      const res = await service.updateCourse(3, {
        rating: 4,
        feedback: 'ok',
      } as any);
      expect(res.rating).toBe(4);
      expect(res.feedback).toBe('ok');
    });
    it('deleteCourse returns true on success', async () => {
      (courseRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
      expect(await service.deleteCourse(4)).toBe(true);
    });
    it('deleteCourse returns false if none affected', async () => {
      (courseRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });
      expect(await service.deleteCourse(5)).toBe(false);
    });
  });

  describe('skills and comments', () => {
    it('addCompetency creates and returns competency', async () => {
      const course = { id: 6 } as any;
      jest.spyOn(service, 'findOne').mockResolvedValue(course);
      const comp = { id: 7 } as any;
      (competencyRepo.create as jest.Mock).mockReturnValue(comp);
      (competencyRepo.save as jest.Mock).mockResolvedValue(comp);
      expect(
        await service.addCompetency({
          courseId: 6,
          name: 'Skill',
          description: 'Desc',
        } as any),
      ).toBe(comp);
    });
    it('validateCompetency not found throws', async () => {
      (competencyRepo.findOne as jest.Mock).mockResolvedValue(undefined);
      await expect(service.validateCompetency(8)).rejects.toThrow(
        NotFoundException,
      );
    });
    it('validateCompetency saves validated and notifies', async () => {
      const comp = {
        id: 9,
        course: { student: { id: 11 } },
        validated: false,
      } as any;
      (competencyRepo.findOne as jest.Mock).mockResolvedValue(comp);
      (competencyRepo.save as jest.Mock).mockResolvedValue({
        ...comp,
        validated: true,
      });
      const res = await service.validateCompetency(9);
      expect(res.validated).toBe(true);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 11,
          notification_type: 'COMPETENCY_VALIDATED',
        }),
      );
    });

    it('addComment creates and notifies', async () => {
      const course = { id: 9, student: { id: 10 } } as any;
      jest.spyOn(service, 'findOne').mockResolvedValue(course);
      const comment = { id: 11 } as any;
      (commentRepo.create as jest.Mock).mockReturnValue(comment);
      (commentRepo.save as jest.Mock).mockResolvedValue(comment);
      expect(
        await service.addComment({
          courseId: 9,
          content: 'Nice',
          author: 10,
        } as any),
      ).toBe(comment);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ notification_type: 'COURSE_COMMENT' }),
      );
    });
  });

  describe('advanced utilities', () => {
    it('updateCourseStatus updates the status', async () => {
      const course = { id: 12, status: 'SCHEDULED' } as any;
      jest.spyOn(service, 'findOne').mockResolvedValue(course);
      (courseRepo.save as jest.Mock).mockResolvedValue({
        ...course,
        status: 'COMPLETED',
      });
      const res = await service.updateCourseStatus(12, 'COMPLETED' as any);
      expect(res.status).toBe('COMPLETED');
    });
    it('findExpiredCourses uses LessThan filter', async () => {
      await service.findExpiredCourses();
      expect(courseRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.any(Object) }),
      );
    });
  });

  describe('getUserInstructionSummary', () => {
    it('throws if user not found', async () => {
      (userService.findOneById as jest.Mock).mockResolvedValue(undefined);
      await expect(service.getUserInstructionSummary(99)).rejects.toThrow(
        NotFoundException,
      );
    });
    it('aggregates summary correctly', async () => {
      (userService.findOneById as jest.Mock).mockResolvedValue({
        id: 1,
        licenses: [],
      });
      const summary = {
        upcomingCourses: [],
        recentCourses: [],
        certifications: [],
        learningProgress: {},
        evaluations: {},
        eLearningCourses: [],
      };
      jest
        .spyOn(service as any, 'getUpcomingCoursesForUser')
        .mockResolvedValue(summary.upcomingCourses);
      jest
        .spyOn(service as any, 'getRecentCoursesForUser')
        .mockResolvedValue(summary.recentCourses);
      jest
        .spyOn(service as any, 'getUserCertifications')
        .mockResolvedValue(summary.certifications);
      jest
        .spyOn(service as any, 'getUserLearningProgress')
        .mockResolvedValue(summary.learningProgress);
      jest
        .spyOn(service as any, 'getUserEvaluationSummary')
        .mockResolvedValue(summary.evaluations);
      jest
        .spyOn(service as any, 'getUserELearningCourses')
        .mockResolvedValue(summary.eLearningCourses);
      const res = await service.getUserInstructionSummary(1);
      expect(res).toEqual(summary);
    });
  });
});
