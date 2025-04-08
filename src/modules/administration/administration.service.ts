import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Administration } from './entity/admin.entity';
import { CreateAdministrationInput } from './dto/create-admin.input';
import { UpdateAdministrationInput } from './dto/update-admin.input';
import { User } from '../users/entity/users.entity';
import {
  Aircraft,
  AvailabilityStatus,
} from '../aircraft/entity/aircraft.entity';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { Flight } from '../flights/entity/flights.entity';
import { Incident } from '../incidents/entity/incidents.entity';
import { AdminDashboardStats } from 'src/types/administration.types';
@Injectable()
export class AdministrationService {
  constructor(
    @InjectRepository(Administration)
    private readonly administrationRepository: Repository<Administration>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Flight)
    private readonly flightRepository: Repository<Flight>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
  ) {}

  async create(
    createAdministrationInput: CreateAdministrationInput,
  ): Promise<Administration> {
    const administration = this.administrationRepository.create(
      createAdministrationInput,
    );
    return this.administrationRepository.save(administration);
  }

  async findAll(): Promise<Administration[]> {
    return this.administrationRepository.find();
  }

  async findOne(id: number): Promise<Administration> {
    const administration = await this.administrationRepository.findOne({
      where: { id },
    });
    if (!administration) {
      throw new NotFoundException(`Administration with ID ${id} not found`);
    }
    return administration;
  }

  async update(
    id: number,
    updateAdministrationInput: UpdateAdministrationInput,
  ): Promise<Administration> {
    const administration = await this.findOne(id);
    Object.assign(administration, updateAdministrationInput);
    return this.administrationRepository.save(administration);
  }

  async remove(id: number): Promise<boolean> {
    const administration = await this.findOne(id);
    await this.administrationRepository.remove(administration);
    return true;
  }

  async getMaintenance(): Promise<boolean> {
    const isMaintenanceActive = this.administrationRepository.findOne({
      where: { id: 1 },
    });

    return (await isMaintenanceActive).isMaintenanceActive;
  }

  async getMaintenanceDetails(): Promise<{
    maintenanceTime: Date;
    maintenanceMessage: string;
  }> {
    const administration = await this.administrationRepository.findOne({
      where: { id: 1 },
    });
    if (!administration) {
      throw new NotFoundException('Administration with ID 1 not found');
    }
    return {
      maintenanceTime: administration.maintenanceTime,
      maintenanceMessage: administration.maintenanceMessage,
    };
  }

  async setMaintenance(): Promise<boolean> {
    const administration = await this.administrationRepository.findOne({
      where: { id: 1 },
    });
    administration.isMaintenanceActive = !administration.isMaintenanceActive;
    await this.administrationRepository.save(administration);
    return administration.isMaintenanceActive;
  }

  async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    try {
      const totalUsers = await this.userRepository.count();
      const totalAircrafts = await this.aircraftRepository.count();
      const totalReservations = await this.reservationRepository.count();
      const totalFlights = await this.flightRepository.count();
      const totalIncidents = await this.incidentRepository.count();
      const availableAircrafts = await this.aircraftRepository.count({
        where: { availability_status: AvailabilityStatus.AVAILABLE },
      });
      const pendingReservations = await this.reservationRepository.count({
        where: { status: ReservationStatus.PENDING },
      });
      const flightHoursThisMonth = await this.flightRepository
        .createQueryBuilder('flight')
        .leftJoin('flight.reservation', 'reservation')
        .select('COALESCE(SUM(flight.flight_hours), 0)', 'totalHours')
        .where(
          'EXTRACT(MONTH FROM reservation.start_time) = EXTRACT(MONTH FROM CURRENT_DATE)',
        )
        .getRawOne();

      const usersByRole = await this.userRepository
        .createQueryBuilder('user')
        .select('"role"."role_name" AS "role_name"')
        .addSelect('"user"."roleId" AS "roleId"')
        .addSelect('COUNT("user".id) AS count')
        .innerJoin('user.role', 'role')
        .groupBy('"user"."roleId", "role"."role_name"')
        .getRawMany();

      const reservationsByCategory = await this.reservationRepository
        .createQueryBuilder('reservation')
        .select('reservation.flight_category AS "flight_category"')
        .addSelect('COUNT(reservation.id) AS count')
        .groupBy('reservation.flight_category')
        .getRawMany();

      return {
        totalUsers,
        totalAircrafts,
        totalReservations,
        totalFlights,
        totalIncidents,
        availableAircrafts,
        pendingReservations,
        flightHoursThisMonth: flightHoursThisMonth.totalHours || 0,
        usersByRole: usersByRole.map((role) => ({
          roleId: role.roleId,
          role_name: role.role_name,
          count: parseInt(role.count),
        })),
        reservationsByCategory: reservationsByCategory.map((cat) => ({
          flight_category: cat.flight_category,
          count: parseInt(cat.count),
        })),
      };
    } catch (error) {
      console.log(error);
      throw new Error(`Error while fetching admin dashboard stats: ${error}`);
    }
  }
}
