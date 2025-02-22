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

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProgress, Lesson]),
    MailerModule,
    forwardRef(() => EvalModule),
    NotificationsModule,
  ],
  providers: [UsersService, UsersResolver, UserProgressResolver],
  exports: [UsersService],
})
export class UsersModule {}
