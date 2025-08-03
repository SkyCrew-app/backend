/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { ReservationsService } from '../reservations.service';
import {
  Reservation,
  ReservationStatus,
  FlightCategory,
} from '../entity/reservations.entity';
import { User } from '../../users/entity/users.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { MailerService } from '../../mail/mailer.service';
import { AdministrationService } from '../../administration/administration.service';
import { PaymentsService } from '../../payments/payments.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateReservationInput } from '../dto/create-reservation.input';
import { UpdateReservationInput } from '../dto/update-reservation.input';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepository: Repository<Reservation>;
  let userRepository: Repository<User>;
  let aircraftRepository: Repository<Aircraft>;
  let mailerService: MailerService;
  let administrationService: AdministrationService;
  let paymentService: PaymentsService;
  let notificationService: NotificationsService;

  const mockReservationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockAircraftRepository = {
    findOne: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  const mockAdministrationService = {
    findAll: jest.fn(),
  };

  const mockPaymentService = {
    createWithdrawal: jest.fn(),
    refund: jest.fn(),
  };

  const mockNotificationService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: mockReservationRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Aircraft),
          useValue: mockAircraftRepository,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: AdministrationService,
          useValue: mockAdministrationService,
        },
        {
          provide: PaymentsService,
          useValue: mockPaymentService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    reservationRepository = module.get<Repository<Reservation>>(
      getRepositoryToken(Reservation),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    aircraftRepository = module.get<Repository<Aircraft>>(
      getRepositoryToken(Aircraft),
    );
    mailerService = module.get<MailerService>(MailerService);
    administrationService = module.get<AdministrationService>(
      AdministrationService,
    );
    paymentService = module.get<PaymentsService>(PaymentsService);
    notificationService =
      module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createReservationInput: CreateReservationInput = {
      aircraft_id: 1,
      user_id: 1,
      start_time: new Date('2023-06-01T08:00:00Z'),
      end_time: new Date('2023-06-01T10:00:00Z'),
      flight_category: FlightCategory.LOCAL,
      reservation_date: new Date('2023-05-25'),
      purpose: 'Training flight',
      estimated_flight_hours: 2,
      notes: 'Clear weather expected',
    };

    it('should create a reservation successfully', async () => {
      const mockAircraft = {
        id: 1,
        registration_number: 'F-ABCD',
        hourly_cost: 150,
      };

      const mockUser = {
        id: 1,
        first_name: 'John',
        email: 'john@test.com',
        user_account_balance: 500,
        total_flight_hours: 10,
        licenses: [{ license_type: 'PPL' }],
      };

      const mockAdministration = [{ pilotLicenses: ['PPL', 'CPL'] }];

      const mockReservation = {
        id: 1,
        ...createReservationInput,
        aircraft: mockAircraft,
        user: mockUser,
        status: ReservationStatus.CONFIRMED,
      };

      mockAircraftRepository.findOne.mockResolvedValue(mockAircraft);
      mockReservationRepository.find.mockResolvedValue([]); // No conflicts
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockAdministrationService.findAll.mockResolvedValue(mockAdministration);
      mockReservationRepository.create.mockReturnValue(mockReservation);
      mockReservationRepository.save.mockResolvedValue(mockReservation);

      const result = await service.create(createReservationInput);

      expect(mockAircraftRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockReservationRepository.find).toHaveBeenCalledWith({
        where: {
          aircraft: { id: 1 },
          start_time: LessThan(createReservationInput.end_time),
          end_time: MoreThan(createReservationInput.start_time),
        },
      });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['licenses'],
      });
      expect(mockPaymentService.createWithdrawal).toHaveBeenCalledWith({
        user_id: 1,
        amount: 300, // 2 hours * 150
        payment_method: 'account_balance',
      });
      expect(mockMailerService.sendMail).toHaveBeenCalled();
      expect(mockNotificationService.create).toHaveBeenCalled();
      expect(result).toEqual(mockReservation);
    });

    it('should throw NotFoundException when aircraft not found', async () => {
      mockAircraftRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createReservationInput)).rejects.toThrow(
        new NotFoundException("L'avion avec l'ID 1 n'existe pas."),
      );
    });

    it('should throw ConflictException when aircraft is already reserved', async () => {
      const mockAircraft = { id: 1, registration_number: 'F-ABCD' };
      const conflictingReservation = { id: 2, aircraft_id: 1 };

      mockAircraftRepository.findOne.mockResolvedValue(mockAircraft);
      mockReservationRepository.find.mockResolvedValue([
        conflictingReservation,
      ]);

      await expect(service.create(createReservationInput)).rejects.toThrow(
        new ConflictException(
          'Cet avion est déjà réservé pour les dates spécifiées.',
        ),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      const mockAircraft = { id: 1, registration_number: 'F-ABCD' };

      mockAircraftRepository.findOne.mockResolvedValue(mockAircraft);
      mockReservationRepository.find.mockResolvedValue([]);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createReservationInput)).rejects.toThrow(
        new NotFoundException("L'utilisateur avec l'ID 1 n'existe pas."),
      );
    });

    it('should throw BadRequestException when user has no licenses', async () => {
      const mockAircraft = { id: 1, registration_number: 'F-ABCD' };
      const mockUser = {
        id: 1,
        licenses: [],
        user_account_balance: 500,
      };

      mockAircraftRepository.findOne.mockResolvedValue(mockAircraft);
      mockReservationRepository.find.mockResolvedValue([]);
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createReservationInput)).rejects.toThrow(
        new BadRequestException(
          "L'utilisateur n'as pas de licences pour réserver cet avion",
        ),
      );
    });

    it('should throw BadRequestException when user has insufficient balance', async () => {
      const mockAircraft = {
        id: 1,
        registration_number: 'F-ABCD',
        hourly_cost: 150,
      };

      const mockUser = {
        id: 1,
        user_account_balance: 100, // Insufficient
        licenses: [{ license_type: 'PPL' }],
      };

      const mockAdministration = [{ pilotLicenses: ['PPL'] }];

      mockAircraftRepository.findOne.mockResolvedValue(mockAircraft);
      mockReservationRepository.find.mockResolvedValue([]);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockAdministrationService.findAll.mockResolvedValue(mockAdministration);

      await expect(service.create(createReservationInput)).rejects.toThrow(
        new BadRequestException('Solde insuffisant pour réserver cet avion'),
      );
    });
  });

  describe('update', () => {
    const updateReservationInput: UpdateReservationInput = {
      id: 1,
      aircraft_id: 1,
      flight_category: FlightCategory.INSTRUCTION,
      notes: 'Updated notes',
    };

    it('should update a reservation successfully', async () => {
      const mockReservation = {
        id: 1,
        user: { id: 1 },
        aircraft: { id: 1 },
        start_time: new Date('2023-06-01T08:00:00Z'),
        end_time: new Date('2023-06-01T10:00:00Z'),
      };

      const mockAircraft = {
        id: 1,
        registration_number: 'F-ABCD',
      };

      const mockUser = {
        id: 1,
        first_name: 'John',
        email: 'john@test.com',
      };

      const updatedReservation = {
        ...mockReservation,
        ...updateReservationInput,
      };

      mockReservationRepository.findOne.mockResolvedValue(mockReservation);
      mockAircraftRepository.findOne.mockResolvedValue(mockAircraft);
      mockReservationRepository.save.mockResolvedValue(updatedReservation);
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.update(updateReservationInput);

      expect(mockReservationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        'john@test.com',
        'Modification de votre réservation',
        expect.any(String),
        'reservation-modification',
        expect.any(Object),
      );
      expect(mockNotificationService.create).toHaveBeenCalled();
      expect(result).toEqual(updatedReservation);
    });

    it('should throw error when reservation not found', async () => {
      mockReservationRepository.findOne.mockResolvedValue(null);

      await expect(service.update(updateReservationInput)).rejects.toThrow(
        'Réservation introuvable',
      );
    });
  });

  describe('delete', () => {
    it('should delete a reservation successfully', async () => {
      const mockReservation = {
        id: 1,
        user: { id: 1 },
        aircraft: { id: 1 },
        start_time: new Date('2023-06-01T08:00:00Z'),
        end_time: new Date('2023-06-01T10:00:00Z'),
      };

      const mockAircraft = {
        id: 1,
        registration_number: 'F-ABCD',
        hourly_cost: 150,
      };

      const mockUser = {
        id: 1,
        first_name: 'John',
        email: 'john@test.com',
      };

      mockReservationRepository.findOne.mockResolvedValue(mockReservation);
      mockAircraftRepository.findOne.mockResolvedValue(mockAircraft);
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await service.delete(1);

      expect(mockReservationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        'john@test.com',
        'Annulation de votre réservation',
        expect.any(String),
        'reservation-cancellation',
        expect.any(Object),
      );
      expect(mockPaymentService.refund).toHaveBeenCalledWith(1, 300);
      expect(mockNotificationService.create).toHaveBeenCalled();
      expect(mockReservationRepository.remove).toHaveBeenCalledWith(
        mockReservation,
      );
    });

    it('should throw error when reservation not found', async () => {
      mockReservationRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(1)).rejects.toThrow(
        'Réservation introuvable',
      );
    });
  });

  describe('findAll', () => {
    it('should return all reservations', async () => {
      const mockReservations = [{ id: 1 }, { id: 2 }];
      mockReservationRepository.find.mockResolvedValue(mockReservations);

      const result = await service.findAll();

      expect(mockReservationRepository.find).toHaveBeenCalled();
      expect(result).toEqual(mockReservations);
    });
  });

  describe('findOne', () => {
    it('should return a reservation by id', async () => {
      const mockReservation = { id: 1 };
      mockReservationRepository.findOne.mockResolvedValue(mockReservation);

      const result = await service.findOne(1);

      expect(mockReservationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockReservation);
    });
  });

  describe('findFilteredReservations', () => {
    it('should return filtered reservations with date range', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      };

      mockReservationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findFilteredReservations(
        '2023-06-01',
        '2023-06-30',
      );

      expect(mockReservationRepository.createQueryBuilder).toHaveBeenCalledWith(
        'reservation',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('should return filtered reservations without date filters', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      };

      mockReservationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findFilteredReservations();

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('findUserReservations', () => {
    it('should return reservations for a specific user', async () => {
      const mockReservations = [{ id: 1, user: { id: 1 } }];
      mockReservationRepository.find.mockResolvedValue(mockReservations);

      const result = await service.findUserReservations(1);

      expect(mockReservationRepository.find).toHaveBeenCalledWith({
        where: { user: { id: 1 } },
        relations: ['aircraft', 'user', 'flights'],
      });
      expect(result).toEqual(mockReservations);
    });
  });

  describe('findReservationsBetween', () => {
    it('should return reservations between dates', async () => {
      const startDate = new Date('2023-06-01');
      const endDate = new Date('2023-06-30');
      const mockReservations = [{ id: 1 }];

      mockReservationRepository.find.mockResolvedValue(mockReservations);

      const result = await service.findReservationsBetween(startDate, endDate);

      expect(mockReservationRepository.find).toHaveBeenCalledWith({
        where: {
          start_time: Between(startDate, endDate),
        },
        relations: ['user', 'flights'],
      });
      expect(result).toEqual(mockReservations);
    });
  });

  describe('findFinishedReservations', () => {
    it('should return finished reservations', async () => {
      const mockReservations = [{ id: 1 }];
      mockReservationRepository.find.mockResolvedValue(mockReservations);

      const result = await service.findFinishedReservations();

      expect(mockReservationRepository.find).toHaveBeenCalledWith({
        where: {
          end_time: LessThan(expect.any(Date)),
        },
        relations: ['user', 'flights'],
      });
      expect(result).toEqual(mockReservations);
    });
  });

  describe('findRecentReservations', () => {
    it('should return recent reservations with limit', async () => {
      const mockReservations = [{ id: 1 }, { id: 2 }];
      mockReservationRepository.find.mockResolvedValue(mockReservations);

      const result = await service.findRecentReservations(5);

      expect(mockReservationRepository.find).toHaveBeenCalledWith({
        order: { start_time: 'DESC' },
        take: 5,
        relations: ['user', 'aircraft'],
      });
      expect(result).toEqual(mockReservations);
    });
  });
});
