import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { Reservation } from '../../reservations/entity/reservations.entity';
import { ReservationTemplate } from '../../reservations/entity/reservation-template.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { Administration } from '../../administration/entity/admin.entity';
import { Flight } from '../../flights/entity/flights.entity';
import { FlightAmendment } from '../../flights/entity/flight-amendment.entity';
import { Incident } from '../../incidents/entity/incidents.entity';
import { Payment } from '../../payments/entity/payments.entity';
import { Invoice } from '../../invoices/entity/invoices.entity';

// Brought in by the bookings, which the courses move with them.
const BOOKING_ENTITIES = [
  Reservation,
  ReservationTemplate,
  Aircraft,
  Administration,
  Flight,
  FlightAmendment,
  Incident,
  Payment,
  Invoice,
];

describe('InstructionCoursesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    let builder = Test.createTestingModule({
      // The users module rate-limits some operations; the limiter is
      // registered by the application module.
      imports: [ThrottlerModule.forRoot([]), InstructionCoursesModule],
    });
    for (const entity of BOOKING_ENTITIES) {
      builder = builder
        .overrideProvider(getRepositoryToken(entity))
        .useValue({});
    }
    module = await builder
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
