import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Reservation, ReservationStatus } from './entity/reservations.entity';
import { CreateReservationInput } from './dto/create-reservation.input';
import { UpdateReservationInput } from './dto/update-reservation.input';
import { MailerService } from '../mail/mailer.service';
import { User } from '../users/entity/users.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    private readonly mailerService: MailerService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
  ) {}

  async create(
    createReservationInput: CreateReservationInput,
  ): Promise<Reservation> {
    const { aircraft_id, start_time, end_time, user_id } =
      createReservationInput;

    const aircraft = await this.aircraftRepository.findOne({
      where: { id: aircraft_id },
    });
    if (!aircraft) {
      throw new Error(`L'avion avec l'ID ${aircraft_id} n'existe pas.`);
    }

    const conflictingReservations = await this.reservationRepository.find({
      where: {
        aircraft: { id: aircraft_id },
        start_time: LessThan(end_time),
        end_time: MoreThan(start_time),
      },
    });

    if (conflictingReservations.length > 0) {
      throw new Error('Cet avion est déjà réservé pour les dates spécifiées.');
    }

    const user = await this.userRepository.findOne({ where: { id: user_id } });
    if (!user) {
      throw new Error(`L'utilisateur avec l'ID ${user_id} n'existe pas.`);
    }

    const reservation = this.reservationRepository.create({
      aircraft,
      user,
      ...createReservationInput,
      status: ReservationStatus.CONFIRMED,
    });

    const formattedStartDate = format(
      new Date(start_time),
      'd MMMM yyyy, HH:mm',
      { locale: fr },
    );
    const formattedEndDate = format(new Date(end_time), 'd MMMM yyyy, HH:mm', {
      locale: fr,
    });

    await this.mailerService.sendMail(
      user.email,
      'Confirmation de votre réservation',
      `Votre réservation pour l'avion ${aircraft.registration_number} a été confirmée.`,
      'reservation-confirmation',
      {
        name: user.first_name,
        aircraft_registration: aircraft.registration_number,
        start_time: formattedStartDate,
        end_time: formattedEndDate,
      },
    );

    const savedReservation = await this.reservationRepository.save(reservation);

    return savedReservation;
  }

  async update(
    updateReservationInput: UpdateReservationInput,
  ): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: updateReservationInput.id },
    });
    if (!reservation) {
      throw new Error('Réservation introuvable');
    }

    const aircraft = await this.aircraftRepository.findOne({
      where: { id: updateReservationInput.aircraft_id },
    });

    const previousStartTime = reservation.start_time;
    const previousEndTime = reservation.end_time;

    Object.assign(reservation, updateReservationInput);
    const updatedReservation =
      await this.reservationRepository.save(reservation);

    const user = await this.userRepository.findOne({
      where: { id: reservation.user.id },
    });
    if (user) {
      await this.mailerService.sendMail(
        user.email,
        'Modification de votre réservation',
        `Votre réservation pour l'avion immatriculé ${aircraft.registration_number} a été modifiée.`,
        'reservation-modification',
        {
          name: user.first_name,
          registration_number: aircraft.registration_number,
          previous_start_time: previousStartTime,
          previous_end_time: previousEndTime,
          new_start_time: updatedReservation.start_time,
          new_end_time: updatedReservation.end_time,
        },
      );
    }

    return updatedReservation;
  }

  async delete(id: number): Promise<void> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
    });
    if (!reservation) {
      throw new Error('Réservation introuvable');
    }

    const aircraft = await this.aircraftRepository.findOne({
      where: { id: reservation.aircraft.id },
    });

    const user = await this.userRepository.findOne({
      where: { id: reservation.user.id },
    });
    if (user) {
      await this.mailerService.sendMail(
        user.email,
        'Annulation de votre réservation',
        `Votre réservation pour l'avion immatriculé ${aircraft.registration_number} a été annulée.`,
        'reservation-cancellation',
        {
          name: user.first_name,
          registration_number: aircraft.registration_number,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
        },
      );
    }

    await this.reservationRepository.remove(reservation);
  }

  async findAll(): Promise<Reservation[]> {
    return this.reservationRepository.find();
  }

  async findOne(id: number): Promise<Reservation> {
    return this.reservationRepository.findOne({
      where: { id },
    });
  }

  async findFilteredReservations(
    startDate?: string,
    endDate?: string,
  ): Promise<Reservation[]> {
    const queryBuilder =
      this.reservationRepository.createQueryBuilder('reservation');

    if (startDate) {
      queryBuilder.andWhere('reservation.start_time >= :startDate', {
        startDate,
      });
    }

    if (endDate) {
      queryBuilder.andWhere('reservation.end_time <= :endDate', { endDate });
    }

    queryBuilder.leftJoinAndSelect('reservation.aircraft', 'aircraft');
    queryBuilder.leftJoinAndSelect('reservation.user', 'user');

    return await queryBuilder.getMany();
  }
}
