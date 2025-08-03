import { Test, TestingModule } from '@nestjs/testing';
import { InstructionCoursesResolver } from '../instruction-courses.resolver';
import { InstructionCoursesService } from '../instruction-courses.service';
import { InstructionCourse } from '../entity/instruction-courses.entity';

describe('InstructionCoursesResolver', () => {
  let resolver: InstructionCoursesResolver;
  let service: any;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findCoursesByStudent: jest.fn(),
      findCoursesByInstructor: jest.fn(),
      createCourse: jest.fn(),
      rateCourse: jest.fn(),
      updateCourse: jest.fn(),
      deleteCourse: jest.fn(),
      addCompetency: jest.fn(),
      validateCompetency: jest.fn(),
      addComment: jest.fn(),
      findCoursesByUserId: jest.fn(),
      getUserInstructionSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstructionCoursesResolver,
        { provide: InstructionCoursesService, useValue: service },
      ],
    }).compile();

    resolver = module.get<InstructionCoursesResolver>(
      InstructionCoursesResolver,
    );
  });

  it('getAllCourses calls service', async () => {
    service.findAll.mockResolvedValue([]);
    expect(await resolver.getAllCourses()).toEqual([]);
  });

  it('getCourseById calls service', async () => {
    const c = { id: 1 } as InstructionCourse;
    service.findOne.mockResolvedValue(c);
    expect(await resolver.getCourseById(1)).toBe(c);
  });

  it('mutations call service', async () => {
    const input = { instructorId: 1, studentId: 2, startTime: new Date() };
    service.createCourse.mockResolvedValue(input);
    expect(await resolver.createCourse(input as any)).toBe(input);
    service.rateCourse.mockResolvedValue(input);
    expect(await resolver.rateCourse(1, 5, 'f')).toBe(input);
    service.updateCourse.mockResolvedValue(input);
    expect(await resolver.updateCourse(input as any)).toBe(input);
    service.deleteCourse.mockResolvedValue(true);
    expect(await resolver.deleteCourse(2)).toBe(true);
    service.addCompetency.mockResolvedValue({} as any);
    expect(
      await resolver.addCompetencyToCourse({ courseId: 1, name: 'n' } as any),
    ).toBeTruthy();
    service.validateCompetency.mockResolvedValue({} as any);
    expect(await resolver.validateCompetency(3)).toBeTruthy();
    service.addComment.mockResolvedValue({} as any);
    expect(
      await resolver.addCommentToCourse({
        courseId: 1,
        content: 'c',
        author: 2,
      } as any),
    ).toBeTruthy();
  });

  it('queries by student/instructor/user summary', async () => {
    service.findCoursesByStudent.mockResolvedValue([]);
    expect(await resolver.getCoursesByStudent(1)).toEqual([]);
    service.findCoursesByInstructor.mockResolvedValue([]);
    expect(await resolver.getCoursesByInstructor(2)).toEqual([]);
    service.findCoursesByUserId.mockResolvedValue([]);
    expect(await resolver.getCoursesByUserId(3)).toEqual([]);
    service.getUserInstructionSummary.mockResolvedValue({});
    expect(await resolver.getUserInstructionSummary(4, {} as any)).toEqual({});
  });
});
