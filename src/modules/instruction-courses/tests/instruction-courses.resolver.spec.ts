import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InstructionCoursesResolver } from '../instruction-courses.resolver';
import { InstructionCoursesService } from '../instruction-courses.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

const admin = { id: 1, email: 'admin@example.com', role: 'Administrateur' };
const instructor = {
  id: 4,
  email: 'instructor@example.com',
  role: { role_name: 'Instructeur' },
};
const otherInstructor = {
  id: 5,
  email: 'other@example.com',
  role: { role_name: 'Instructeur' },
};
const student = {
  id: 3,
  email: 'student@example.com',
  role: { role_name: 'Pilote' },
};
const stranger = {
  id: 7,
  email: 'stranger@example.com',
  role: { role_name: 'Pilote' },
};

// Course 10: given by the instructor (4) to the student (3).
const course = { id: 10, instructor: { id: 4 }, student: { id: 3 } } as any;

describe('InstructionCoursesResolver', () => {
  let resolver: InstructionCoursesResolver;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([course]),
      findOne: jest.fn().mockResolvedValue(course),
      findCoursesByStudent: jest.fn().mockResolvedValue([course]),
      findCoursesByInstructor: jest.fn().mockResolvedValue([course]),
      findCoursesByUserId: jest.fn().mockResolvedValue([course]),
      findCourseOfCompetency: jest.fn().mockResolvedValue(course),
      teaches: jest.fn().mockResolvedValue(false),
      createCourse: jest.fn().mockImplementation(async (input) => input),
      rateCourse: jest.fn().mockResolvedValue(course),
      updateCourse: jest.fn().mockResolvedValue(course),
      deleteCourse: jest.fn().mockResolvedValue(true),
      addCompetency: jest.fn().mockResolvedValue({ id: 1 }),
      validateCompetency: jest.fn().mockResolvedValue({ id: 1 }),
      addComment: jest.fn().mockImplementation(async (input) => input),
      getUserInstructionSummary: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstructionCoursesResolver,
        { provide: InstructionCoursesService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get(InstructionCoursesResolver);
  });

  describe('reading a course', () => {
    it.each([
      ['its instructor', instructor],
      ['its student', student],
      ['an administrator', admin],
    ])('is allowed for %s', async (_label, caller) => {
      await expect(resolver.getCourseById(10, caller)).resolves.toBe(course);
    });

    it.each([
      ['another member', stranger],
      ['another instructor', otherInstructor],
    ])('is refused for %s', async (_label, caller) => {
      await expect(resolver.getCourseById(10, caller)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("listing a user's courses", () => {
    it('returns everything to the user and to an administrator', async () => {
      await expect(resolver.getCoursesByUserId(3, student)).resolves.toEqual([
        course,
      ]);
      await expect(resolver.getCoursesByStudent(3, admin)).resolves.toEqual([
        course,
      ]);
      await expect(
        resolver.getCoursesByInstructor(4, instructor),
      ).resolves.toEqual([course]);
    });

    it('only returns to an instructor the courses they share with the student', async () => {
      const otherCourse = { id: 11, instructor: { id: 5 }, student: { id: 3 } };
      service.findCoursesByStudent.mockResolvedValue([course, otherCourse]);

      await expect(
        resolver.getCoursesByStudent(3, instructor),
      ).resolves.toEqual([course]);
    });

    it('refuses a caller who shares no course with the user', async () => {
      await expect(resolver.getCoursesByStudent(3, stranger)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        resolver.getCoursesByUserId(3, otherInstructor),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        resolver.getCoursesByInstructor(4, stranger),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('creating a course', () => {
    const input = {
      instructorId: 5,
      studentId: 3,
      startTime: new Date('2030-01-01T09:00:00Z'),
    } as any;

    it('makes the instructor who creates it the instructor of the course', async () => {
      await resolver.createCourse(input, instructor);

      expect(service.createCourse).toHaveBeenCalledWith({
        ...input,
        instructorId: 4,
      });
    });

    it('lets an administrator choose the instructor', async () => {
      await resolver.createCourse(input, admin);

      expect(service.createCourse).toHaveBeenCalledWith(input);
    });

    it('refuses a member who is not an instructor', async () => {
      await expect(resolver.createCourse(input, student)).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.createCourse).not.toHaveBeenCalled();
    });
  });

  describe('managing a course', () => {
    const manage: Array<[string, (caller: any) => Promise<unknown>]> = [
      [
        'updateCourse',
        (caller) => resolver.updateCourse({ id: 10 } as any, caller),
      ],
      ['deleteCourse', (caller) => resolver.deleteCourse(10, caller)],
      [
        'addCompetencyToCourse',
        (caller) =>
          resolver.addCompetencyToCourse(
            { courseId: 10, name: 'n' } as any,
            caller,
          ),
      ],
      [
        'validateCompetency',
        (caller) => resolver.validateCompetency(1, caller),
      ],
    ];

    it.each(manage)(
      '%s is allowed for the instructor of the course',
      async (_n, call) => {
        await expect(call(instructor)).resolves.toBeDefined();
      },
    );

    it.each(manage)('%s is allowed for an administrator', async (_n, call) => {
      await expect(call(admin)).resolves.toBeDefined();
    });

    it.each(manage)('%s is refused for the student', async (_n, call) => {
      await expect(call(student)).rejects.toThrow(ForbiddenException);
    });

    it.each(manage)(
      '%s is refused for another instructor',
      async (_n, call) => {
        await expect(call(otherInstructor)).rejects.toThrow(ForbiddenException);
        expect(service.updateCourse).not.toHaveBeenCalled();
        expect(service.deleteCourse).not.toHaveBeenCalled();
        expect(service.addCompetency).not.toHaveBeenCalled();
        expect(service.validateCompetency).not.toHaveBeenCalled();
      },
    );
  });

  describe('rating a course', () => {
    it('is the student of the course', async () => {
      await expect(resolver.rateCourse(10, 5, 'bien', student)).resolves.toBe(
        course,
      );
      expect(service.rateCourse).toHaveBeenCalledWith(10, 5, 'bien');
    });

    it.each([
      ['the instructor', instructor],
      ['another member', stranger],
    ])('is refused for %s', async (_label, caller) => {
      await expect(resolver.rateCourse(10, 5, 'bien', caller)).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.rateCourse).not.toHaveBeenCalled();
    });
  });

  describe('commenting a course', () => {
    it('records the caller as the author, whatever author is sent', async () => {
      await resolver.addCommentToCourse(
        { courseId: 10, content: 'ok', author: 999 },
        student,
      );

      expect(service.addComment).toHaveBeenCalledWith({
        courseId: 10,
        content: 'ok',
        author: 3,
      });
    });

    it('is refused for someone outside the course', async () => {
      await expect(
        resolver.addCommentToCourse(
          { courseId: 10, content: 'ok', author: 7 },
          stranger,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(service.addComment).not.toHaveBeenCalled();
    });
  });

  describe('instruction summary', () => {
    it("defaults to the caller's own summary", async () => {
      await resolver.getUserInstructionSummary(undefined, student);

      expect(service.getUserInstructionSummary).toHaveBeenCalledWith(3);
    });

    it('is allowed for an instructor of the student', async () => {
      service.teaches.mockResolvedValue(true);

      await resolver.getUserInstructionSummary(3, instructor);

      expect(service.teaches).toHaveBeenCalledWith(4, 3);
      expect(service.getUserInstructionSummary).toHaveBeenCalledWith(3);
    });

    it.each([
      ['an instructor who does not teach the student', otherInstructor],
      ['another member', stranger],
    ])('is refused for %s', async (_label, caller) => {
      await expect(
        resolver.getUserInstructionSummary(3, caller),
      ).rejects.toThrow(ForbiddenException);
      expect(service.getUserInstructionSummary).not.toHaveBeenCalled();
    });
  });

  it('lists every course for an administrator', async () => {
    await expect(resolver.getAllCourses()).resolves.toEqual([course]);
  });
});
