import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';
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

@Injectable()
export class AircraftService {
  private readonly logger = new Logger(AircraftService.name);

  constructor(
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
  ) {}

  async findAll(): Promise<Aircraft[]> {
    const aircraft = await this.aircraftRepository.find({
      relations: ['reservations', 'maintenances'],
    });
    return aircraft.map((item) => withEffectiveAvailability(item));
  }

  findOne(aircraftId: number): Promise<Aircraft> {
    return this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
      relations: ['reservations', 'maintenances'],
    });
  }

  async create(
    createAircraftInput: CreateAircraftInput,
    filePaths: string[],
    imagePath: string | null,
  ): Promise<Aircraft> {
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
    const input = await this.withoutHeldStatus(aircraftId, updateAircraftInput);

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

  async updateStatus(
    aircraftId: number,
    availabilityStatus: AvailabilityStatus,
  ): Promise<Aircraft> {
    const aircraft = await this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
    });
    aircraft.availability_status = availabilityStatus;
    return this.aircraftRepository.save(aircraft);
  }

  async aircraftHistory(options?: any): Promise<Aircraft[]> {
    const aircraft = await this.aircraftRepository.find(options);
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
