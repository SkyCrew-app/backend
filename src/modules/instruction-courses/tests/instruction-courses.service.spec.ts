import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { InstructionCoursesService } from '../instruction-courses.service';
import { InstructionCourse } from '../entity/instruction-courses.entity';
import { CourseCompetency } from '../entity/course-competency.entity';
import { CourseComment } from '../entity/course-comment.entity';
import { UserProgress } from '../../users/entity/user-progress.entity';
import { Lesson } from '../../e-learning/entity/lesson.entity';
import { UsersService } from '../../users/users.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ELearningService } from '../../e-learning/e-learning.service';
import { translationOf } from '../../../common/i18n/localized-exception';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

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
    userService = {
      findOneById: jest.fn(),
      getEvaluationResults: jest.fn(),
      countCompletedLessons: jest.fn().mockResolvedValue(0),
    };
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

  const hour = 3_600_000;
  // A one-hour slot, tomorrow.
  const slot = {
    startTime: new Date(Date.now() + 24 * hour),
    endTime: new Date(Date.now() + 25 * hour),
  };
  const instructor = { id: 1, role: { role_name: 'Instructeur' } };
  const admin = { id: 50, email: 'a@example.com', role: 'Administrateur' };
  const teacher = {
    id: 4,
    email: 'i@example.com',
    role: { role_name: 'Instructeur' },
  };

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

    it('lets courses follow each other, ignores cancelled ones and the course being edited', async () => {
      (courseRepo.findOne as jest.Mock).mockResolvedValue(undefined);

      await service.checkScheduleConflict(
        1,
        2,
        slot.startTime,
        slot.endTime,
        9,
      );

      const { where } = (courseRepo.findOne as jest.Mock).mock.calls[0][0];
      expect(where).toHaveLength(2);
      expect(where[0].instructor).toEqual({ id: 1 });
      expect(where[1].student).toEqual({ id: 2 });
      for (const condition of where) {
        // Strictly before the end and strictly after the start: a course
        // ending when this one starts is not in the way.
        expect(condition.startTime).toEqual(LessThan(slot.endTime));
        expect(condition.endTime).toEqual(MoreThan(slot.startTime));
        expect(condition.status).toEqual(Not('CANCELED'));
        expect(condition.id).toEqual(Not(9));
      }
    });
  });

  describe('createCourse', () => {
    const input = { instructorId: 1, studentId: 2, ...slot } as any;

    beforeEach(() => {
      (userService.findOneById as jest.Mock).mockImplementation(async (id) =>
        id === 1 ? instructor : { id },
      );
      (courseRepo.create as jest.Mock).mockImplementation((value) => value);
      (courseRepo.save as jest.Mock).mockImplementation(async (value) => ({
        id: 5,
        ...value,
      }));
    });

    // The refusal used to be a bare Error in English: a server error for
    // the member.
    it('throws on conflict', async () => {
      jest.spyOn(service, 'checkScheduleConflict').mockResolvedValue(true);
      await expect(service.createCourse(input)).rejects.toThrow(
        ConflictException,
      );
      expect(courseRepo.save).not.toHaveBeenCalled();
    });

    it('creates course and notifies both users', async () => {
      jest.spyOn(service, 'checkScheduleConflict').mockResolvedValue(false);

      const res = await service.createCourse(input);
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(res).toMatchObject({ id: 5, student: { id: 2 } });
    });

    it('never takes a rating from whoever plans the course', async () => {
      jest.spyOn(service, 'checkScheduleConflict').mockResolvedValue(false);

      const res = await service.createCourse({
        ...input,
        rating: 5,
        feedback: 'parfait',
      });

      expect(res).not.toHaveProperty('rating');
      expect(res).not.toHaveProperty('feedback');
    });

    it.each([
      ['the instructor as their own student', { studentId: 1 }],
      ['an end before the start', { endTime: slot.startTime }],
      ['someone who is not an instructor', { instructorId: 3 }],
    ])('refuses %s', async (_label, values) => {
      jest.spyOn(service, 'checkScheduleConflict').mockResolvedValue(false);

      await expect(
        service.createCourse({ ...input, ...values }),
      ).rejects.toThrow(BadRequestException);
      expect(courseRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      ['the student', 2],
      ['the instructor', 1],
    ])('refuses a course when %s is deactivated', async (_label, gone) => {
      jest.spyOn(service, 'checkScheduleConflict').mockResolvedValue(false);
      (userService.findOneById as jest.Mock).mockImplementation(async (id) => ({
        ...(id === 1 ? instructor : { id }),
        is_active: id !== gone,
      }));

      const error = await service.createCourse(input).catch((caught) => caught);

      expect(translationOf(error)?.key).toBe('error.course.memberInactive');
      expect(courseRepo.save).not.toHaveBeenCalled();
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
    const planned = (values: object = {}) =>
      ({
        id: 3,
        status: 'SCHEDULED',
        instructor: { id: 4 },
        student: { id: 3 },
        ...slot,
        ...values,
      }) as any;

    beforeEach(() => {
      (courseRepo.save as jest.Mock).mockImplementation(async (c) => c);
      (courseRepo.findOne as jest.Mock).mockResolvedValue(undefined);
    });

    // This test used to assert that the update wrote the rating and the
    // feedback, which are the student's.
    it('updateCourse refuses to write the rating or the feedback of the student', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());

      await expect(
        service.updateCourse(3, { rating: 4, feedback: 'ok' } as any, teacher),
      ).rejects.toThrow(ForbiddenException);
      expect(courseRepo.save).not.toHaveBeenCalled();
    });

    it('updateCourse lets the instructor change the times and the status', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());
      const later = new Date(slot.endTime.getTime() + hour);

      const res = await service.updateCourse(
        3,
        // The form sends the participants back unchanged.
        {
          id: 3,
          endTime: later,
          status: 'IN_PROGRESS',
          instructorId: 4,
          studentId: 3,
        } as any,
        teacher,
      );

      expect(res).toMatchObject({ endTime: later, status: 'IN_PROGRESS' });
      expect(res.instructor).toEqual({ id: 4 });
    });

    it.each([
      ['hand the course to another instructor', { instructorId: 5 }],
      ['give it to another student', { studentId: 7 }],
    ])(
      'updateCourse refuses an instructor trying to %s',
      async (_label, changes) => {
        jest.spyOn(service, 'findOne').mockResolvedValue(planned());

        await expect(
          service.updateCourse(3, { id: 3, ...changes } as any, teacher),
        ).rejects.toThrow(ForbiddenException);
        expect(courseRepo.save).not.toHaveBeenCalled();
      },
    );

    it('updateCourse lets an administrator change the status, the instructor and the student', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());
      (userService.findOneById as jest.Mock).mockResolvedValue({
        id: 5,
        role: { role_name: 'Instructeur' },
      });

      const res = await service.updateCourse(
        3,
        {
          id: 99,
          status: 'COMPLETED',
          instructorId: 5,
          studentId: 7,
        } as any,
        admin,
      );

      expect(res.status).toBe('COMPLETED');
      expect(res.instructor).toEqual({ id: 5 });
      expect(res.student).toEqual({ id: 7 });
      expect(res.id).toBe(3);
      expect(res).not.toHaveProperty('instructorId');
      expect(res).not.toHaveProperty('studentId');
    });

    it('updateCourse refuses to hand a course to a deactivated student', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());
      (userService.findOneById as jest.Mock).mockResolvedValue({
        id: 7,
        is_active: false,
      });

      const error = await service
        .updateCourse(3, { studentId: 7 } as any, admin)
        .catch((caught) => caught);

      expect(translationOf(error)?.key).toBe('error.course.memberInactive');
      expect(courseRepo.save).not.toHaveBeenCalled();
    });

    it('updateCourse keeps the instructor and the student when they are not sent', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());

      const res = await service.updateCourse(
        3,
        { id: 3, status: 'IN_PROGRESS' } as any,
        teacher,
      );

      expect(res.instructor).toEqual({ id: 4 });
      expect(res.student).toEqual({ id: 3 });
    });

    it('updateCourse refuses new times that run into another course', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());
      const conflict = jest
        .spyOn(service, 'checkScheduleConflict')
        .mockResolvedValue(true);
      const later = new Date(slot.endTime.getTime() + hour);

      await expect(
        service.updateCourse(3, { id: 3, endTime: later } as any, teacher),
      ).rejects.toThrow(ConflictException);
      // The course itself is left out of the search.
      expect(conflict).toHaveBeenCalledWith(4, 3, slot.startTime, later, 3);
      expect(courseRepo.save).not.toHaveBeenCalled();
    });

    it('updateCourse refuses an end before the start', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());

      await expect(
        service.updateCourse(
          3,
          { id: 3, endTime: new Date(slot.startTime.getTime() - hour) } as any,
          teacher,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deleteCourse returns true on success', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());
      (courseRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
      expect(await service.deleteCourse(4)).toBe(true);
    });
    it('deleteCourse returns false if none affected', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned());
      (courseRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });
      expect(await service.deleteCourse(5)).toBe(false);
    });

    it.each([
      ['took place', { status: 'COMPLETED' }],
      ['has validated competencies', { competencies: [{ id: 1 }] }],
      ['has comments', { comments: [{ id: 1 }] }],
      ['was rated', { rating: 4 }],
    ])('deleteCourse keeps a course that %s', async (_label, values) => {
      jest.spyOn(service, 'findOne').mockResolvedValue(planned(values));

      await expect(service.deleteCourse(3)).rejects.toThrow(ConflictException);
      expect(courseRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('rating and validation', () => {
    const held = (values: object = {}) =>
      ({
        id: 3,
        status: 'COMPLETED',
        startTime: new Date(Date.now() - 2 * hour),
        student: { id: 11 },
        ...values,
      }) as any;

    beforeEach(() => {
      (courseRepo.save as jest.Mock).mockImplementation(async (c) => c);
    });

    it('rateCourse records the rating of a course that took place', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(held());

      await expect(service.rateCourse(3, 4, 'bien')).resolves.toMatchObject({
        rating: 4,
        feedback: 'bien',
      });
    });

    it.each([0, 6, 99, 2.5, -1])(
      'rateCourse refuses a rating of %s',
      async (rating) => {
        jest.spyOn(service, 'findOne').mockResolvedValue(held());

        await expect(service.rateCourse(3, rating, '')).rejects.toThrow(
          BadRequestException,
        );
        expect(courseRepo.save).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['has not started', { startTime: new Date(Date.now() + hour) }],
      ['is cancelled', { status: 'CANCELED' }],
    ])(
      'nothing is rated or validated on a course that %s',
      async (_label, values) => {
        jest.spyOn(service, 'findOne').mockResolvedValue(held(values));
        (competencyRepo.findOne as jest.Mock).mockResolvedValue({
          id: 9,
          validated: false,
          course: held(values),
        });

        await expect(service.rateCourse(3, 4, '')).rejects.toThrow(
          ConflictException,
        );
        await expect(service.validateCompetency(9)).rejects.toThrow(
          ConflictException,
        );
        expect(courseRepo.save).not.toHaveBeenCalled();
        expect(competencyRepo.save).not.toHaveBeenCalled();
      },
    );
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
      const withAuthor = { id: 11, author: { id: 10, first_name: 'Jean' } };
      (commentRepo.create as jest.Mock).mockReturnValue(comment);
      (commentRepo.save as jest.Mock).mockResolvedValue(comment);
      (commentRepo.findOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue(withAuthor);
      expect(
        await service.addComment({
          courseId: 9,
          content: 'Nice',
          author: 10,
        } as any),
      ).toBe(withAuthor);
      expect(commentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 11 },
        relations: ['author'],
      });
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
    // The nightly job notifies both: without them it failed on the first
    // course and stopped.
    it('findExpiredCourses loads the instructor and the student', async () => {
      await service.findExpiredCourses();
      expect(courseRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['instructor', 'student'] }),
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
