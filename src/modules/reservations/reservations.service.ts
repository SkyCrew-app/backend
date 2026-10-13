import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
import { Reservation, ReservationStatus } from './entity/reservations.entity';
import { ReservationTemplate } from './entity/reservation-template.entity';
import { CreateReservationInput } from './dto/create-reservation.input';
import { UpdateReservationInput } from './dto/update-reservation.input';
import { CreateReservationTemplateInput } from './dto/create-reservation-template.input';
import { UpdateReservationTemplateInput } from './dto/update-reservation-template.input';
import { MailerService } from '../mail/mailer.service';
import { User } from '../users/entity/users.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { format } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { AdministrationService } from '../administration/administration.service';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { languageOf } from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

// A date as written in an e-mail, in the member's language.
const mailDate = (date: Date | string, language: string) =>
  format(new Date(date), 'd MMMM yyyy, HH:mm', {
    locale: language === 'en' ? enGB : fr,
  });

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(ReservationTemplate)
    private templateRepository: Repository<ReservationTemplate>,
    private readonly mailerService: MailerService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
    private readonly administrationService: AdministrationService,
    private readonly paymentService: PaymentsService,
    private readonly notificationService: NotificationsService,
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
      throw localized(NotFoundException, 'error.reservation.aircraftNotFound', {
        aircraftId: aircraft_id,
      });
    }

    const conflictingReservations = await this.reservationRepository.find({
      where: {
        aircraft: { id: aircraft_id },
        start_time: LessThan(end_time),
        end_time: MoreThan(start_time),
      },
    });

    if (conflictingReservations.length > 0) {
      throw localized(
        ConflictException,
        'error.reservation.aircraftAlreadyBooked',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: user_id },
      relations: ['licenses'],
    });

    if (!user) {
      throw localized(NotFoundException, 'error.reservation.userNotFound', {
        userId: user_id,
      });
    }

    const administration = await this.administrationService.findAll();
    if (!administration) {
      throw localized(NotFoundException, 'error.reservation.noClubSettings');
    }

    const authorizedLicenses = administration[0].pilotLicenses;

    const userLicenses = user.licenses.map((license) => license.license_type);

    const hasLicense = authorizedLicenses.some((license) =>
      userLicenses.includes(license),
    );

    if (!hasLicense) {
      throw localized(BadRequestException, 'error.reservation.noValidLicence');
    }

    if (user.licenses.length == 0) {
      throw localized(BadRequestException, 'error.reservation.noValidLicence');
    }

    const startTime = new Date(start_time);
    const endTime = new Date(end_time);
    const hoursReserved =
      (endTime.getTime() - startTime.getTime()) / 1000 / 60 / 60;
    const totalCost = hoursReserved * aircraft.hourly_cost;

    if (user.user_account_balance < totalCost) {
      throw localized(
        BadRequestException,
        'error.reservation.insufficientBalance',
      );
    }

    const reservation = this.reservationRepository.create({
      aircraft,
      user,
      ...createReservationInput,
      status: ReservationStatus.CONFIRMED,
    });

    // The confirmation is written to the member the reservation is for.
    const language = languageOf(user);
    const locale = language === 'en' ? enGB : fr;
    const formattedStartDate = format(
      new Date(start_time),
      'd MMMM yyyy, HH:mm',
      { locale },
    );
    const formattedEndDate = format(new Date(end_time), 'd MMMM yyyy, HH:mm', {
      locale,
    });

    await this.mailerService.sendMail(
      user.email,
      translate(language, 'mail.reservationConfirmed.subject'),
      translate(language, 'mail.reservationConfirmed.text', {
        registration: aircraft.registration_number,
      }),
      'reservation-confirmation',
      {
        name: user.first_name,
        aircraft_registration: aircraft.registration_number,
        start_time: formattedStartDate,
        end_time: formattedEndDate,
      },
      language,
    );

    await this.notificationService.create({
      user_id: user.id,
      notification_type: 'RESERVATION_CONFIRMED',
      notification_date: new Date(),
      message: translate(language, 'notification.reservationConfirmed', {
        registration: aircraft.registration_number,
      }),
      is_read: false,
    });

    const savedReservation = await this.reservationRepository.save(reservation);

    // Flight hours are counted when the flight is closed, not when it is booked.
    await this.paymentService.createWithdrawal({
      user_id: user.id,
      amount: totalCost,
      payment_method: 'account_balance',
    });

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
      const language = languageOf(user);
      await this.mailerService.sendMail(
        user.email,
        translate(language, 'mail.reservationModified.subject'),
        translate(language, 'mail.reservationModified.text', {
          registration: aircraft.registration_number,
        }),
        'reservation-modification',
        {
          name: user.first_name,
          aircraft_registration: aircraft.registration_number,
          previous_start_time: mailDate(previousStartTime, language),
          previous_end_time: mailDate(previousEndTime, language),
          new_start_time: mailDate(updatedReservation.start_time, language),
          new_end_time: mailDate(updatedReservation.end_time, language),
        },
        language,
      );

      await this.notificationService.create({
        user_id: user.id,
        notification_type: 'RESERVATION_MODIFIED',
        notification_date: new Date(),
        message: translate(language, 'notification.reservationModified', {
          registration: aircraft.registration_number,
        }),
        is_read: false,
      });
    }

    return updatedReservation;
  }

  async delete(id: number): Promise<void> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['flights'],
    });
    if (!reservation) {
      throw new Error('Réservation introuvable');
    }
    // A closed flight is in the logbook and has been charged: its booking stays.
    if ((reservation.flights ?? []).some((flight) => flight.closed_at)) {
      throw new ConflictException(
        'Le vol de cette réservation est clôturé : elle ne peut plus être annulée.',
      );
    }

    const aircraft = await this.aircraftRepository.findOne({
      where: { id: reservation.aircraft.id },
    });

    const user = await this.userRepository.findOne({
      where: { id: reservation.user.id },
    });
    if (user) {
      const language = languageOf(user);
      await this.mailerService.sendMail(
        user.email,
        translate(language, 'mail.reservationCancelled.subject'),
        translate(language, 'mail.reservationCancelled.text', {
          registration: aircraft.registration_number,
        }),
        'reservation-cancellation',
        {
          name: user.first_name,
          aircraft_registration: aircraft.registration_number,
          start_time: mailDate(reservation.start_time, language),
          end_time: mailDate(reservation.end_time, language),
        },
        language,
      );

      const startTime = new Date(reservation.start_time);
      const endTime = new Date(reservation.end_time);
      const hoursReserved =
        (endTime.getTime() - startTime.getTime()) / 1000 / 60 / 60;

      const totalCost = hoursReserved * aircraft.hourly_cost;

      await this.paymentService.refund(user.id, totalCost);

      await this.notificationService.create({
        user_id: user.id,
        notification_type: 'RESERVATION_CANCELLED',
        notification_date: new Date(),
        message: translate(language, 'notification.reservationCancelled', {
          registration: aircraft.registration_number,
        }),
        is_read: false,
      });
    }

    await this.reservationRepository.remove(reservation);
  }

  async findAll(): Promise<Reservation[]> {
    return this.reservationRepository.find();
  }

  // Id of the user who holds a reservation, or null if it does not exist.
  async findOwnerId(id: number): Promise<number | null> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    return reservation?.user?.id ?? null;
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

  async findUserReservations(userId: number): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { user: { id: userId } },
      relations: ['aircraft', 'user', 'flights'],
    });
  }

  async findReservationsBetween(
    start: Date,
    end: Date,
  ): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: {
        start_time: Between(start, end),
      },
      relations: ['user', 'flights'],
    });
  }

  async findFinishedReservations(): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: {
        end_time: LessThan(new Date()),
      },
      relations: ['user', 'flights'],
    });
  }

  async findRecentReservations(limit: number): Promise<Reservation[]> {
    return this.reservationRepository.find({
      order: { start_time: 'DESC' },
      take: limit,
      relations: ['user', 'aircraft'],
    });
  }

  // === Reservation Templates ===

  async getUserTemplates(userId: number): Promise<ReservationTemplate[]> {
    return this.templateRepository.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async findOneTemplate(id: number): Promise<ReservationTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template avec l'ID ${id} introuvable`);
    }
    return template;
  }

  async createTemplate(
    userId: number,
    input: CreateReservationTemplateInput,
  ): Promise<ReservationTemplate> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable`);
    }

    let aircraft: Aircraft | null = null;
    if (input.aircraft_id) {
      aircraft = await this.aircraftRepository.findOne({
        where: { id: input.aircraft_id },
      });
    }

    const template = this.templateRepository.create({
      ...input,
      user,
      aircraft,
    });

    return this.templateRepository.save(template);
  }

  async updateTemplate(
    userId: number,
    input: UpdateReservationTemplateInput,
  ): Promise<ReservationTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id: input.id, user: { id: userId } },
    });
    if (!template) {
      throw new NotFoundException(`Template introuvable ou non autorisé`);
    }

    if (input.aircraft_id !== undefined) {
      template.aircraft = input.aircraft_id
        ? await this.aircraftRepository.findOne({
            where: { id: input.aircraft_id },
          })
        : null;
    }

    // The identifier and the aircraft are handled apart from the other fields.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, aircraft_id, ...rest } = input;
    Object.assign(template, rest);

    return this.templateRepository.save(template);
  }

  async deleteTemplate(userId: number, id: number): Promise<boolean> {
    const template = await this.templateRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!template) {
      throw new NotFoundException(`Template introuvable ou non autorisé`);
    }
    await this.templateRepository.remove(template);
    return true;
  }
}
