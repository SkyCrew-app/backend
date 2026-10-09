import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CourseResolver,
  ModuleResolver,
  LessonResolver,
} from '../e-learning.resolver';
import { ELearningService } from '../e-learning.service';
import { UsersService } from '../../users/users.service';

const admin = { id: 1, email: 'admin@example.com', role: 'Administrateur' };
const member = (id: number) => ({
  id,
  email: `user${id}@example.com`,
  role: { role_name: 'Pilote' },
});

describe('E-Learning Resolvers', () => {
  let courseResolver: CourseResolver;
  let moduleResolver: ModuleResolver;
  let lessonResolver: LessonResolver;
  let eLearningService: any;
  let userService: any;

  beforeEach(async () => {
    eLearningService = {
      getCourses: jest.fn(),
      getCourseById: jest.fn(),
      createCourse: jest.fn(),
      updateCourse: jest.fn(),
      deleteCourse: jest.fn(),
      getModulesByCourse: jest.fn(),
      getAllModules: jest.fn(),
      createModule: jest.fn(),
      updateModule: jest.fn(),
      deleteModule: jest.fn(),
      getLessonContent: jest.fn(),
      getLessonsByModule: jest.fn(),
      createLesson: jest.fn(),
      updateLesson: jest.fn(),
      deleteLesson: jest.fn(),
      completeLesson: jest.fn(),
    };
    userService = { getCourseProgress: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseResolver,
        ModuleResolver,
        LessonResolver,
        { provide: ELearningService, useValue: eLearningService },
        { provide: UsersService, useValue: userService },
      ],
    }).compile();

    courseResolver = module.get<CourseResolver>(CourseResolver);
    moduleResolver = module.get<ModuleResolver>(ModuleResolver);
    lessonResolver = module.get<LessonResolver>(LessonResolver);
  });

  it('getCourses calls service', async () => {
    (eLearningService.getCourses as jest.Mock).mockResolvedValue([]);
    expect(await courseResolver.getCourses()).toEqual([]);
    expect(eLearningService.getCourses).toHaveBeenCalled();
  });

  it('getCourseById calls service', async () => {
    (eLearningService.getCourseById as jest.Mock).mockResolvedValue({ id: 1 });
    expect(await courseResolver.getCourseById(1)).toEqual({ id: 1 });
  });

  it('createCourse calls service', async () => {
    const dto = { title: 'T' };
    (eLearningService.createCourse as jest.Mock).mockResolvedValue({ id: 2 });
    expect(await courseResolver.createCourse(dto)).toEqual({ id: 2 });
  });

  it('progress resolves service call', async () => {
    const course = { id: 3 } as any;
    const context = { req: { user: { id: 4 } } };
    (userService.getCourseProgress as jest.Mock).mockResolvedValue(80);
    expect(await courseResolver.progress(course, context)).toBe(80);
  });

  it('getModulesByCourse calls service', async () => {
    (eLearningService.getModulesByCourse as jest.Mock).mockResolvedValue([
      { id: 5 },
    ]);
    expect(await moduleResolver.getModulesByCourse(10)).toEqual([{ id: 5 }]);
  });

  it('getAllModules calls service', async () => {
    (eLearningService.getAllModules as jest.Mock).mockResolvedValue([]);
    expect(await moduleResolver.getAllModules()).toEqual([]);
  });

  it('createModule calls service', async () => {
    (eLearningService.createModule as jest.Mock).mockResolvedValue({ id: 6 });
    expect(
      await moduleResolver.createModule({ title: 'M', courseId: 1 }),
    ).toEqual({ id: 6 });
  });

  it('getLessonContent calls service', async () => {
    (eLearningService.getLessonContent as jest.Mock).mockResolvedValue({
      id: 7,
    });
    expect(await lessonResolver.getLessonContent(7, 8, admin)).toEqual({
      id: 7,
    });
  });

  it('completeLesson calls service', async () => {
    await lessonResolver.completeLesson(9, 10, admin);
    expect(eLearningService.completeLesson).toHaveBeenCalledWith(10, 9);
  });
  describe('authorization', () => {
    it("refuses recording another user's progress", async () => {
      await expect(
        lessonResolver.completeLesson(9, 7, member(3)),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        lessonResolver.getLessonContent(9, 7, member(3)),
      ).rejects.toThrow(ForbiddenException);
    });

    it("refuses a member reading a course with another user's progress", async () => {
      await expect(
        courseResolver.getCourseById(1, 7, member(3)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets a user complete their own lesson', async () => {
      await expect(
        lessonResolver.completeLesson(9, 3, member(3)),
      ).resolves.toBe(true);
    });
  });
});
