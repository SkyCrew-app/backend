import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reservation } from './entity/reservations.entity';
import { Repository } from 'typeorm';
import { MailerService } from '../mail/mailer.service';
import { User } from '../users/entity/users.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { ReservationStatus } from './entity/reservations.entity';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

jest.mock('date-fns', () => ({
  format: jest.fn(),
}));

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepository: Partial<Repository<Reservation>>;
  let userRepository: Partial<Repository<User>>;
  let aircraftRepository: Partial<Repository<Aircraft>>;
  let mailerService: Partial<MailerService>;

  beforeEach(async () => {
    reservationRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    userRepository = {
      findOne: jest.fn(),
    };
    aircraftRepository = {
      findOne: jest.fn(),
    };
    mailerService = {
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: reservationRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Aircraft), useValue: aircraftRepository },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a reservation', async () => {
    const createReservationInput = {
      aircraft_id: 1,
      start_time: new Date(),
      end_time: new Date(),
      user_id: 1,
      reservation_date: new Date(),
    };

    const user = {
      id: 1,
      email: 'john.doe@example.com',
      first_name: 'John',
    } as User;
    const aircraft = { id: 1, registration_number: 'ABC123' } as Aircraft;
    const reservation = {
      id: 1,
      ...createReservationInput,
      user,
      aircraft,
      flight: null,
      estimated_flight_hours: 2,
      purpose: 'Training',
      status: ReservationStatus.PENDING,
      notes: null,
      flight_category: null,
      calendar_integration_url: null,
    } as Reservation;

    (aircraftRepository.findOne as jest.Mock).mockResolvedValue(aircraft);
    (userRepository.findOne as jest.Mock).mockResolvedValue(user);
    (reservationRepository.find as jest.Mock).mockResolvedValue([]);
    (reservationRepository.create as jest.Mock).mockReturnValue(reservation);
    (reservationRepository.save as jest.Mock).mockResolvedValue(reservation);

    const formattedStartDate = '1 janvier 2024, 10:00';
    const formattedEndDate = '1 janvier 2024, 12:00';

    // Mock de `format` pour retourner une date formatée
    (format as jest.Mock)
      .mockReturnValueOnce(formattedStartDate)
      .mockReturnValueOnce(formattedEndDate);

    const result = await service.create(createReservationInput);

    expect(format).toHaveBeenCalledTimes(2);
    expect(format).toHaveBeenCalledWith(
      expect.any(Date),
      'd MMMM yyyy, HH:mm',
      { locale: fr },
    );
    expect(reservationRepository.save).toHaveBeenCalledWith(reservation);
    expect(result).toEqual(reservation);
  });

  it('should update a reservation', async () => {
    const updateReservationInput = {
      id: 1,
      aircraft_id: 1,
      start_time: new Date(),
      end_time: new Date(),
      reservation_date: new Date(),
    };

    const user = {
      id: 1,
      email: 'john.doe@example.com',
      first_name: 'John',
    } as User;
    const aircraft = { id: 1, registration_number: 'ABC123' } as Aircraft;
    const reservation = {
      id: 1,
      ...updateReservationInput,
      flight: null,
      estimated_flight_hours: 2,
      purpose: 'Training',
      status: ReservationStatus.CONFIRMED,
      notes: null,
      flight_category: null,
      calendar_integration_url: null,
      aircraft,
      user,
    } as Reservation;

    (reservationRepository.findOne as jest.Mock).mockResolvedValue(reservation);
    (reservationRepository.save as jest.Mock).mockResolvedValue(reservation);

    const result = await service.update(updateReservationInput);

    expect(reservationRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(reservationRepository.save).toHaveBeenCalledWith(reservation);
    expect(result).toEqual(reservation);
  });

  it('should throw an error if the aircraft is not found', async () => {
    (aircraftRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create({
        aircraft_id: 1,
        start_time: new Date(),
        end_time: new Date(),
        user_id: 1,
        reservation_date: new Date(),
      }),
    ).rejects.toThrow(`L'avion avec l'ID 1 n'existe pas.`);
  });
});
