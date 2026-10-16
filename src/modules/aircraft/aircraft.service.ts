import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Aircraft } from './entity/aircraft.entity';
import { CreateAircraftInput } from './dto/create-aircraft.input';
import { AvailabilityStatus } from './entity/aircraft.entity';
import * as path from 'path';
import * as fs from 'fs';
import { UpdateAircraftInput } from './dto/update-aircraft.input';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { ReservationTemplate } from '../reservations/entity/reservation-template.entity';
import { Maintenance } from '../maintenance/entity/maintenance.entity';
import { Incident } from '../incidents/entity/incidents.entity';
import { Audit } from '../audit/entity/audit.entity';
import { Expense } from '../financial/entity/expense.entity';
import {
  AIRCRAFT_IN_MAINTENANCE,
  groundsAircraftAt,
} from '../maintenance/maintenance-rules';
import { localized } from '../../common/i18n/localized-exception';
import { PlanService } from '../../common/plan/plan.service';
import {
  countAircraftInService,
  usesAircraftPlace,
} from '../../common/plan/plan-usage';

// The fleet history shows the bookings of the last months (and those to
// come), not the club's whole history.
export const FLEET_HISTORY_MONTHS = 12;

export const fleetHistoryStart = (now: Date = new Date()): Date => {
  const start = new Date(now);
  start.setMonth(start.getMonth() - FLEET_HISTORY_MONTHS);
  return start;
};

// An aircraft held by a maintenance is unavailable whatever its stored
// status says. Nothing is written: the status comes back when the
// maintenance ends.
export const withEffectiveAvailability = (
  aircraft: Aircraft,
  moment: Date = new Date(),
): Aircraft => {
  const held = (aircraft.maintenances ?? []).some((maintenance) =>
    groundsAircraftAt(maintenance, moment),
  );
  if (held) {
    aircraft.availability_status = AvailabilityStatus.UNAVAILABLE;
    aircraft.maintenance_status = AIRCRAFT_IN_MAINTENANCE;
  }
  return aircraft;
};

// The first powered aircraft flew in 1903 (same bounds as the form).
export const FIRST_MANUFACTURE_YEAR = 1903;

// The columns the database requires (NOT NULL, no default), refused with a
// message rather than a database error: all of them on a creation, an
// explicit empty value on an update.
export function assertAircraftRequired(
  input: Partial<
    Pick<
      CreateAircraftInput,
      'registration_number' | 'model' | 'year_of_manufacture' | 'hourly_cost'
    >
  >,
  creating: boolean,
  now: Date = new Date(),
): void {
  const given = (key: keyof typeof input) =>
    creating || (key in input && input[key] !== undefined);
  const text = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0;
  if (given('registration_number') && !text(input.registration_number))
    throw localized(BadRequestException, 'error.aircraft.registrationRequired');
  if (given('model') && !text(input.model))
    throw localized(BadRequestException, 'error.aircraft.modelRequired');
  const max = now.getFullYear();
  const year = input.year_of_manufacture;
  if (
    given('year_of_manufacture') &&
    !(
      typeof year === 'number' &&
      Number.isInteger(year) &&
      year >= FIRST_MANUFACTURE_YEAR &&
      year <= max
    )
  ) {
    throw localized(BadRequestException, 'error.aircraft.yearRequired', {
      min: FIRST_MANUFACTURE_YEAR,
      max,
    });
  }
  const cost = input.hourly_cost;
  if (
    given('hourly_cost') &&
    !(typeof cost === 'number' && Number.isFinite(cost) && cost >= 0)
  )
    throw localized(BadRequestException, 'error.aircraft.hourlyCostRequired');
}

@Injectable()
export class AircraftService {
  private readonly logger = new Logger(AircraftService.name);

  constructor(
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
    @Optional() private readonly plan: PlanService = new PlanService(),
  ) {}

  // An aircraft about to take a place in the plan (added, or put back in
  // service): refused once the plan's places are all used. What is already
  // in service above the limit stays as it is.
  private async assertPlaceFor(
    from: AvailabilityStatus | null,
    to: AvailabilityStatus | null | undefined,
  ): Promise<void> {
    if (
      this.plan.maxAircraft === null ||
      to == null ||
      !usesAircraftPlace(to) ||
      (from !== null && usesAircraftPlace(from))
    ) {
      return;
    }
    this.plan.assertRoomForAircraft(
      await countAircraftInService(this.aircraftRepository.manager),
    );
  }

  // Without the bookings: the resolver loads them when they are asked for.
  async findAll(): Promise<Aircraft[]> {
    const aircraft = await this.aircraftRepository.find({
      relations: ['maintenances'],
    });
    return aircraft.map((item) => withEffectiveAvailability(item));
  }

  findOne(aircraftId: number): Promise<Aircraft> {
    return this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
      relations: ['maintenances'],
    });
  }

  reservationsOf(aircraftId: number): Promise<Reservation[]> {
    return this.aircraftRepository.manager.find(Reservation, {
      where: { aircraft: { id: aircraftId } },
      order: { start_time: 'ASC' },
    });
  }

  async create(
    createAircraftInput: CreateAircraftInput,
    filePaths: string[],
    imagePath: string | null,
  ): Promise<Aircraft> {
    await this.assertPlaceFor(
      null,
      createAircraftInput.availability_status ?? AvailabilityStatus.AVAILABLE,
    );
    assertAircraftRequired(createAircraftInput, true);
    const newAircraft = this.aircraftRepository.create(createAircraftInput);

    await this.aircraftRepository.save(newAircraft);

    const aircraftDir = path.join(
      __dirname,
      '../../uploads',
      String(newAircraft.id),
    );

    if (!fs.existsSync(aircraftDir)) {
      fs.mkdirSync(aircraftDir, { recursive: true });
    }

    if (filePaths && filePaths.length > 0) {
      newAircraft.documents_url = filePaths.map((filePath) => {
        const destinationPath = path.join(aircraftDir, path.basename(filePath));
        fs.renameSync(filePath, destinationPath);
        return `/uploads/${newAircraft.id}/${path.basename(filePath)}`;
      });
    }

    if (imagePath) {
      const destinationImagePath = path.join(
        aircraftDir,
        path.basename(imagePath),
      );
      fs.renameSync(imagePath, destinationImagePath);
      newAircraft.image_url = `/uploads/${newAircraft.id}/${path.basename(imagePath)}`;
    }

    return this.aircraftRepository.save(newAircraft);
  }

  async update(
    aircraftId: number,
    updateAircraftInput: UpdateAircraftInput,
    filePaths: string[],
    imagePath: string | null,
  ): Promise<Aircraft> {
    const aircraft = await this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
    });
    assertAircraftRequired(updateAircraftInput, false);
    const input = await this.withoutHeldStatus(aircraftId, updateAircraftInput);
    await this.assertPlaceFor(
      aircraft.availability_status,
      input.availability_status,
    );

    const aircraftDir = path.join(
      __dirname,
      '../../uploads',
      String(aircraftId),
    );

    if (!fs.existsSync(aircraftDir)) {
      fs.mkdirSync(aircraftDir, { recursive: true });
    }

    if (filePaths && filePaths.length > 0) {
      aircraft.documents_url = filePaths.map((filePath) => {
        const destinationPath = path.join(aircraftDir, path.basename(filePath));
        fs.renameSync(filePath, destinationPath);
        return `/uploads/${aircraftId}/${path.basename(filePath)}`;
      });
    }

    if (imagePath) {
      const destinationImagePath = path.join(
        aircraftDir,
        path.basename(imagePath),
      );
      fs.renameSync(imagePath, destinationImagePath);
      aircraft.image_url = `/uploads/${aircraftId}/${path.basename(imagePath)}`;
    }

    Object.assign(aircraft, input);

    return this.aircraftRepository.save(aircraft);
  }

  // While a maintenance holds the aircraft, the statuses shown are dictated
  // by it (see withEffectiveAvailability): the form sends them back as they
  // were shown, and they must not replace the stored ones. Asking for
  // another availability is refused.
  private async withoutHeldStatus(
    aircraftId: number,
    input: UpdateAircraftInput,
  ): Promise<UpdateAircraftInput> {
    if (
      input.availability_status === undefined &&
      input.maintenance_status === undefined
    ) {
      return input;
    }

    const maintenances = await this.aircraftRepository.manager.find(
      Maintenance,
      { where: { aircraft: { id: aircraftId } } },
    );
    if (!maintenances.some((maintenance) => groundsAircraftAt(maintenance))) {
      return input;
    }

    if (
      input.availability_status != null &&
      input.availability_status !== AvailabilityStatus.UNAVAILABLE
    ) {
      throw localized(ConflictException, 'error.aircraft.heldByMaintenance');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { availability_status, maintenance_status, ...rest } = input;
    return rest;
  }

  // The registration and the availability as stored (not as a maintenance
  // makes them look), or null for an unknown aircraft.
  async storedStatus(aircraftId: number): Promise<{
    registration_number: string;
    availability_status: AvailabilityStatus;
  } | null> {
    const aircraft = await this.aircraftRepository.findOne({
      where: { id: aircraftId },
      select: ['id', 'registration_number', 'availability_status'],
    });
    return aircraft
      ? {
          registration_number: aircraft.registration_number,
          availability_status: aircraft.availability_status,
        }
      : null;
  }

  async updateStatus(
    aircraftId: number,
    availabilityStatus: AvailabilityStatus,
  ): Promise<Aircraft> {
    const aircraft = await this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
    });
    await this.assertPlaceFor(aircraft.availability_status, availabilityStatus);
    aircraft.availability_status = availabilityStatus;
    return this.aircraftRepository.save(aircraft);
  }

  // With `bookingsSince`, each aircraft comes with its bookings from that
  // date on (and their member), loaded in one query.
  async aircraftHistory(
    options: { relations?: string[]; bookingsSince?: Date } = {},
  ): Promise<Aircraft[]> {
    const { bookingsSince, ...findOptions } = options;
    const aircraft = await this.aircraftRepository.find(findOptions);
    if (bookingsSince) {
      const bookings = await this.aircraftRepository.manager.find(Reservation, {
        where: { start_time: MoreThanOrEqual(bookingsSince) },
        relations: ['aircraft', 'user'],
        loadEagerRelations: false,
        order: { start_time: 'ASC' },
      });
      for (const item of aircraft) {
        item.reservations = bookings.filter(
          (booking) => Number(booking.aircraft?.id) === Number(item.id),
        );
      }
    }
    return aircraft.map((item) => withEffectiveAvailability(item));
  }

  // Deletes an aircraft nothing refers to, with its files. An aircraft with a
  // history (bookings, maintenance, incidents, audits, expenses) is never
  // deleted: it is retired, that is made unavailable, and false is returned.
  // Upcoming bookings must be dealt with first.
  async remove(aircraftId: number): Promise<boolean> {
    const aircraft = await this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
    });
    const manager = this.aircraftRepository.manager;
    const ofAircraft = { aircraft: { id: aircraftId } };

    const upcoming = await manager.count(Reservation, {
      where: {
        ...ofAircraft,
        end_time: MoreThan(new Date()),
        status: Not(ReservationStatus.CANCELLED),
      },
    });
    if (upcoming > 0) {
      throw localized(ConflictException, 'error.aircraft.upcomingBookings', {
        count: upcoming,
      });
    }

    const references = await Promise.all(
      [
        Reservation,
        Maintenance,
        Incident,
        Audit,
        Expense,
        ReservationTemplate,
      ].map((entity) => manager.count(entity, { where: ofAircraft })),
    );

    if (references.some((count) => count > 0)) {
      aircraft.availability_status = AvailabilityStatus.UNAVAILABLE;
      await this.aircraftRepository.save(aircraft);
      return false;
    }

    // The row first: files are only erased once the aircraft is gone.
    await this.aircraftRepository.remove(aircraft);

    const aircraftDir = path.join(
      __dirname,
      '../../uploads',
      String(aircraftId),
    );
    try {
      fs.rmSync(aircraftDir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Files of deleted aircraft ${aircraftId} could not be removed: ${(error as Error).message}`,
      );
    }

    return true;
  }
}
