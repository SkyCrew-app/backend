import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { Reservation } from '../reservations/entity/reservations.entity';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { MemberDepartureService } from './member-departure.service';
import { MemberDepartureResolver } from './member-departure.resolver';
import { AdminActionsModule } from '../../common/admin-actions/admin-actions.module';

// Kept apart from UsersModule, which the booking modules may depend on:
// this one depends on both.
@Module({
  imports: [
    UsersModule,
    ReservationsModule,
    AdminActionsModule,
    TypeOrmModule.forFeature([Reservation, InstructionCourse]),
  ],
  providers: [MemberDepartureService, MemberDepartureResolver],
})
export class MemberDepartureModule {}
