import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersResolver, UserProgressResolver } from './users.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/users.entity';
import { MailerModule } from '../mail/mailer.module';
import { UserProgress } from './entity/user-progress.entity';
import { Lesson } from '../e-learning/entity/lesson.entity';
import { EvalModule } from '../eval/eval.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminActionsModule } from '../../common/admin-actions/admin-actions.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { Reservation } from '../reservations/entity/reservations.entity';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { InstructorRoleChangeService } from './instructor-role-change.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProgress,
      Lesson,
      Reservation,
      InstructionCourse,
    ]),
    MailerModule,
    forwardRef(() => EvalModule),
    NotificationsModule,
    AdminActionsModule,
    ReservationsModule,
  ],
  providers: [
    UsersService,
    UsersResolver,
    UserProgressResolver,
    InstructorRoleChangeService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
