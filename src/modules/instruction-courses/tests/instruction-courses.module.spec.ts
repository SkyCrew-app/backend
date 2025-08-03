import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { InstructionCoursesModule } from '../instruction-courses.module';
import { InstructionCourse } from '../entity/instruction-courses.entity';
import { CourseCompetency } from '../entity/course-competency.entity';
import { CourseComment } from '../entity/course-comment.entity';
import { UserProgress } from '../../users/entity/user-progress.entity';
import { User } from '../../users/entity/users.entity';
import { Lesson } from '../../e-learning/entity/lesson.entity';
import { DataSource } from 'typeorm';
import { Evaluation } from '../../eval/entity/evaluation.entity';
import { Question } from '../../eval/entity/question.entity';
import { Answer } from '../../eval/entity/answer.entity';
import { Module } from '../../e-learning/entity/module.entity';
import { Notification } from '../../notifications/entity/notifications.entity';
import { Course } from '../../e-learning/entity/course.entity';

describe('InstructionCoursesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [InstructionCoursesModule],
    })
      .overrideProvider(getRepositoryToken(InstructionCourse))
      .useValue({})
      .overrideProvider(getRepositoryToken(CourseCompetency))
      .useValue({})
      .overrideProvider(getRepositoryToken(CourseComment))
      .useValue({})
      .overrideProvider(getRepositoryToken(UserProgress))
      .useValue({})
      .overrideProvider(getRepositoryToken(Lesson))
      .useValue({})
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .overrideProvider(getRepositoryToken(Evaluation))
      .useValue({})
      .overrideProvider(getRepositoryToken(Question))
      .useValue({})
      .overrideProvider(getRepositoryToken(Answer))
      .useValue({})
      .overrideProvider(getRepositoryToken(Module))
      .useValue({})
      .overrideProvider(getRepositoryToken(Notification))
      .useValue({})
      .overrideProvider(getRepositoryToken(Course))
      .useValue({})
      .overrideProvider(getDataSourceToken())
      .useValue({})
      .overrideProvider(DataSource)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });
});
