import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  Parent,
  ResolveField,
} from '@nestjs/graphql';
import { Reservation } from '../reservations/entity/reservations.entity';
import { AircraftService, fleetHistoryStart } from './aircraft.service';
import { Aircraft, AvailabilityStatus } from './entity/aircraft.entity';
import { CreateAircraftInput } from './dto/create-aircraft.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { saveUploadToTmp } from '../../common/uploads/save-upload';
import { UpdateAircraftInput } from './dto/update-aircraft.input';
import { UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionUser } from '../../common/auth/access';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';

type StoredStatus = Awaited<ReturnType<AircraftService['storedStatus']>>;

@Resolver(() => Aircraft)
@UseFilters(LocalizedExceptionFilter)
export class AircraftResolver {
  constructor(
    private readonly aircraftService: AircraftService,
    private readonly adminActions: AdminActionsService,
  ) {}

  // The aircraft as it stands before an action, for the trace only: a
  // failed lookup never stops the action itself.
  private async before(aircraftId: number): Promise<StoredStatus> {
    try {
      return await this.aircraftService.storedStatus(aircraftId);
    } catch {
      return null;
    }
  }

  // An aircraft grounded or put back in service by hand leaves a line.
  private async traceAvailability(
    currentUser: SessionUser | undefined,
    aircraftId: number,
    before: StoredStatus,
    after: Aircraft | null | undefined,
  ): Promise<void> {
    const from = before?.availability_status ?? null;
    const to = after?.availability_status ?? null;
    if (!to || from === to) {
      return;
    }
    const action =
      to === AvailabilityStatus.UNAVAILABLE
        ? ADMIN_ACTION.AIRCRAFT_GROUNDED
        : from === AvailabilityStatus.UNAVAILABLE
          ? ADMIN_ACTION.AIRCRAFT_RETURNED_TO_SERVICE
          : null;
    if (!action) {
      return;
    }
    await this.adminActions.record(
      currentUser,
      action,
      {
        type: 'aircraft',
        id: aircraftId,
        label: after?.registration_number ?? before?.registration_number,
      },
      { from, to },
    );
  }

  // The bookings of an aircraft are loaded only when a query asks for them:
  // the fleet list does not, and they are the whole history.
  @ResolveField('reservations', () => [Reservation])
  reservations(@Parent() aircraft: Aircraft): Promise<Reservation[]> {
    return aircraft.reservations
      ? Promise.resolve(aircraft.reservations)
      : this.aircraftService.reservationsOf(aircraft.id);
  }

  @Query(() => [Aircraft], { name: 'getAircrafts' })
  @UseGuards(JwtAuthGuard)
  getAircrafts() {
    return this.aircraftService.findAll();
  }

  @Mutation(() => Aircraft)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async createAircraft(
    @Args('createAircraftInput') createAircraftInput: CreateAircraftInput,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file?: FileUpload,
    @Args({ name: 'image', type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
  ): Promise<Aircraft> {
    const filePaths: string[] = [];
    let imagePath: string | null = null;

    if (file) {
      filePaths.push(await saveUploadToTmp(file, 'document'));
    }

    if (image) {
      imagePath = await saveUploadToTmp(image, 'picture');
    }

    return this.aircraftService.create(
      createAircraftInput,
      filePaths,
      imagePath,
    );
  }

  @Mutation(() => Aircraft)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updateAircraft(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @Args('updateAircraftInput') updateAircraftInput: UpdateAircraftInput,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file?: FileUpload,
    @Args({ name: 'image', type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Aircraft> {
    const filePaths: string[] = [];
    let imagePath: string | null = null;

    if (file) {
      filePaths.push(await saveUploadToTmp(file, 'document'));
    }

    if (image) {
      imagePath = await saveUploadToTmp(image, 'picture');
    }

    // The form can also ground the aircraft or put it back in service.
    const before =
      updateAircraftInput?.availability_status != null
        ? await this.before(aircraftId)
        : null;
    const updated = await this.aircraftService.update(
      aircraftId,
      updateAircraftInput,
      filePaths,
      imagePath,
    );
    if (before) {
      await this.traceAvailability(currentUser, aircraftId, before, updated);
    }
    return updated;
  }

  @Query(() => [Aircraft])
  @UseGuards(JwtAuthGuard)
  async getHistoryAircraft(): Promise<Aircraft[]> {
    return this.aircraftService.aircraftHistory({
      relations: ['maintenances', 'maintenances.technician'],
      bookingsSince: fleetHistoryStart(),
    });
  }

  // Grounds an aircraft or puts it back in service, for instance after an
  // incident: the job of administrators and technicians.
  @Mutation(() => Aircraft)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Technicien')
  async setAircraftAvailability(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @Args('availability_status', { type: () => AvailabilityStatus })
    availabilityStatus: AvailabilityStatus,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Aircraft> {
    const before = await this.before(aircraftId);
    const updated = await this.aircraftService.updateStatus(
      aircraftId,
      availabilityStatus,
    );
    await this.traceAvailability(currentUser, aircraftId, before, updated);
    return updated;
  }

  @Mutation(() => Boolean, {
    description:
      'true when the aircraft was deleted, false when it has a history and was retired (made unavailable) instead',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async deleteAircraft(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<boolean> {
    const before = await this.before(aircraftId);
    const deleted = await this.aircraftService.remove(aircraftId);
    await this.adminActions.record(
      currentUser,
      deleted ? ADMIN_ACTION.AIRCRAFT_DELETED : ADMIN_ACTION.AIRCRAFT_RETIRED,
      {
        type: 'aircraft',
        id: aircraftId,
        label: before?.registration_number,
      },
    );
    return deleted;
  }
}
