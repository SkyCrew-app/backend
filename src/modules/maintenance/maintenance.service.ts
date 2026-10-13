import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { Maintenance } from './entity/maintenance.entity';
import { CreateMaintenanceInput } from './dto/create-maintenance.input';
import { UpdateMaintenanceInput } from './dto/update-maintenance.input';
import { AircraftService } from '../aircraft/aircraft.service';
import * as path from 'path';
import * as fs from 'fs';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { User } from '../users/entity/users.entity';
import { freeFileName } from '../../common/uploads/save-upload';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { localized } from '../../common/i18n/localized-exception';
import {
  MAINTENANCE_OVER_BOOKINGS,
  maintenanceWindow,
  occupiesAircraft,
} from './maintenance-rules';

// Bookings named in a refusal before the list is cut short.
const CONFLICTS_NAMED = 5;

const twoDigits = (value: number): string => String(value).padStart(2, '0');

// Day and time as stored, readable in French and in English.
const formatSlotTime = (value: Date): string => {
  const date = new Date(value);
  return (
    `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
  );
};

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(Maintenance)
    private readonly maintenanceRepository: Repository<Maintenance>,
    private readonly aircraftService: AircraftService,
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  // The aircraft and the period a maintenance takes, and whether it still
  // takes them (a finished or cancelled one does not).
  private slotOf(maintenance: Maintenance): string {
    return [
      maintenance.aircraft?.id,
      new Date(maintenance.start_date).getTime(),
      new Date(maintenance.end_date).getTime(),
      occupiesAircraft(maintenance),
    ].join('|');
  }

  // A maintenance has a duration, and is not planned over bookings without
  // the planner being told which ones.
  private async assertSchedulable(
    maintenance: Maintenance,
    // What was already planned, when a maintenance is edited: nothing is
    // looked at again while the slot it takes stays the same.
    previousSlot?: string,
  ): Promise<void> {
    if (previousSlot === this.slotOf(maintenance)) {
      return;
    }

    // A maintenance of one day starts and ends on the same date.
    const window = maintenanceWindow(maintenance);
    if (
      !window ||
      new Date(maintenance.end_date).getTime() < window.start.getTime()
    ) {
      throw localized(BadRequestException, 'error.maintenance.endBeforeStart');
    }
    const { start, end } = window;

    if (
      MAINTENANCE_OVER_BOOKINGS === 'allow' ||
      !occupiesAircraft(maintenance) ||
      !maintenance.aircraft?.id
    ) {
      return;
    }

    const conflicts = await this.reservationRepository.find({
      where: {
        aircraft: { id: maintenance.aircraft.id },
        start_time: LessThan(end),
        end_time: MoreThan(start),
        status: Not(ReservationStatus.CANCELLED),
      },
      relations: ['user'],
      order: { start_time: 'ASC' },
    });
    if (conflicts.length === 0) {
      return;
    }

    const named = conflicts
      .slice(0, CONFLICTS_NAMED)
      .map((reservation) => {
        const holder = [
          reservation.user?.first_name,
          reservation.user?.last_name,
        ]
          .filter(Boolean)
          .join(' ');
        return `N°${reservation.id}${holder ? ` ${holder}` : ''} (${formatSlotTime(reservation.start_time)} – ${formatSlotTime(reservation.end_time)})`;
      })
      .join(', ');
    const more = conflicts.length - CONFLICTS_NAMED;

    throw localized(ConflictException, 'error.maintenance.overBookings', {
      count: conflicts.length,
      bookings: more > 0 ? `${named}, +${more}` : named,
    });
  }

  async create(
    createMaintenanceInput: CreateMaintenanceInput,
    filePaths: string[],
    imagePaths: string[],
  ): Promise<Maintenance> {
    const aircraft = await this.aircraftService.findOne(
      createMaintenanceInput.aircraft_id,
    );
    if (!aircraft) {
      throw new NotFoundException('Aircraft not found');
    }

    const { technician_id, ...maintenanceFields } = createMaintenanceInput;

    const newMaintenance = this.maintenanceRepository.create({
      ...maintenanceFields,
      aircraft,
    });

    await this.assignTechnician(newMaintenance, technician_id);
    await this.assertSchedulable(newMaintenance);

    await this.maintenanceRepository.save(newMaintenance);

    if (filePaths?.length) {
      newMaintenance.documents_url = this.storeAttachments(
        newMaintenance.id,
        filePaths,
      );
    }
    if (imagePaths?.length) {
      newMaintenance.images_url = this.storeAttachments(
        newMaintenance.id,
        imagePaths,
      );
    }

    return this.maintenanceRepository.save(newMaintenance);
  }

  async update(
    updateMaintenanceInput: UpdateMaintenanceInput,
    filePaths: string[],
    imagePaths: string[],
  ): Promise<Maintenance> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id: updateMaintenanceInput.id },
      relations: ['aircraft', 'technician'],
    });

    if (!maintenance) {
      throw new NotFoundException('Maintenance not found');
    }

    const previousSlot = this.slotOf(maintenance);

    if (updateMaintenanceInput.aircraft_id) {
      const aircraft = await this.aircraftRepository.findOne({
        where: { id: updateMaintenanceInput.aircraft_id },
      });

      if (!aircraft) {
        throw new NotFoundException(
          `Aircraft with ID ${updateMaintenanceInput.aircraft_id} not found`,
        );
      }

      maintenance.aircraft = aircraft;
    }

    await this.assignTechnician(
      maintenance,
      updateMaintenanceInput.technician_id,
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { aircraft_id, technician_id, ...otherFields } =
      updateMaintenanceInput;
    Object.assign(maintenance, otherFields);

    await this.assertSchedulable(maintenance, previousSlot);

    // New files are added to the ones already attached, once nothing can
    // refuse the update any more.
    maintenance.documents_url = [
      ...(maintenance.documents_url ?? []),
      ...this.storeAttachments(maintenance.id, filePaths),
    ];
    maintenance.images_url = [
      ...(maintenance.images_url ?? []),
      ...this.storeAttachments(maintenance.id, imagePaths),
    ];

    return this.maintenanceRepository.save(maintenance);
  }

  // An id assigns that technician, null removes the current one and an
  // absent value leaves the assignment as it is.
  private async assignTechnician(
    maintenance: Maintenance,
    technicianId?: number | null,
  ): Promise<void> {
    if (technicianId === undefined) {
      return;
    }

    if (technicianId === null) {
      maintenance.technician = null;
      return;
    }

    const technician = await this.userRepository.findOne({
      where: { id: technicianId },
    });

    if (!technician) {
      throw localized(
        NotFoundException,
        'error.maintenance.technicianNotFound',
      );
    }
    maintenance.technician = technician;
  }

  async findOne(id: number): Promise<Maintenance> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
    });
    if (!maintenance) {
      throw new NotFoundException('Maintenance not found');
    }
    return maintenance;
  }

  async removeAttachment(id: number, url: string): Promise<Maintenance> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
      relations: ['aircraft', 'technician'],
    });
    if (!maintenance) {
      throw new NotFoundException('Maintenance not found');
    }

    const documents = maintenance.documents_url ?? [];
    const images = maintenance.images_url ?? [];
    if (!documents.includes(url) && !images.includes(url)) {
      throw new NotFoundException('Attachment not found');
    }

    maintenance.documents_url = documents.filter((item) => item !== url);
    maintenance.images_url = images.filter((item) => item !== url);
    const saved = await this.maintenanceRepository.save(maintenance);

    // The address was one of this maintenance: only its file name is used.
    fs.rmSync(path.join(this.attachmentsDirectory(id), path.basename(url)), {
      force: true,
    });

    return saved;
  }

  private attachmentsDirectory(maintenanceId: number): string {
    return path.join(
      __dirname,
      '../../uploads/maintenance',
      String(maintenanceId),
    );
  }

  // Moves uploaded files into the folder of the maintenance and returns
  // their addresses. A file never replaces another one with the same name.
  private storeAttachments(
    maintenanceId: number,
    temporaryPaths: string[] = [],
  ): string[] {
    if (!temporaryPaths?.length) {
      return [];
    }

    const directory = this.attachmentsDirectory(maintenanceId);
    fs.mkdirSync(directory, { recursive: true });

    return temporaryPaths.map((temporaryPath) => {
      const name = freeFileName(temporaryPath, (candidate) =>
        fs.existsSync(path.join(directory, candidate)),
      );
      fs.renameSync(temporaryPath, path.join(directory, name));
      return `/uploads/maintenance/${maintenanceId}/${name}`;
    });
  }

  async remove(id: number): Promise<boolean> {
    const maintenance = await this.findOne(id);
    await this.maintenanceRepository.remove(maintenance);
    return true;
  }

  async findAllByAircraft(aircraftId: number): Promise<Maintenance[]> {
    return this.maintenanceRepository.find({
      where: { aircraft: { id: aircraftId } },
      relations: ['aircraft', 'technician'],
    });
  }

  async findAll(): Promise<Maintenance[]> {
    return this.maintenanceRepository.find({
      relations: ['aircraft', 'technician'],
    });
  }
}
