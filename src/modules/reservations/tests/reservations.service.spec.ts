/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, Not } from 'typeorm';
import { ReservationsService } from '../reservations.service';
import {
  Reservation,
  ReservationStatus,
  FlightCategory,
} from '../entity/reservations.entity';
import { ReservationTemplate } from '../entity/reservation-template.entity';
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

  const mockTemplateRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
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
          provide: getRepositoryToken(ReservationTemplate),
          useValue: mockTemplateRepository,
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

  // Creating, changing and cancelling a booking move money: they are tested
  // against a database stand-in in reservations.booking.spec.ts.

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
      // Every booking that touches the period, even across its bounds.
      expect(mockQueryBuilder.andWhere.mock.calls).toEqual([
        ['reservation.end_time > :startDate', { startDate: '2023-06-01' }],
        ['reservation.start_time < :endDate', { endDate: '2023-06-30' }],
      ]);
      // Aircraft, pilot, instructor and flights.
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(4);
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
      // Upcoming bookings, then the latest past ones (see query-weight).
      mockReservationRepository.find
        .mockResolvedValueOnce([{ id: 2, user: { id: 1 } }])
        .mockResolvedValueOnce([{ id: 1, user: { id: 1 } }]);

      const result = await service.findUserReservations(1);

      expect(mockReservationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user: { id: 1 } }),
          relations: ['aircraft', 'user', 'flights'],
        }),
      );
      expect(result.map((r) => r.id)).toEqual([1, 2]);
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

      const since = new Date('2026-10-01T00:00:00Z');
      const now = new Date('2026-10-08T00:00:00Z');
      const result = await service.findFinishedReservations(since, now);

      // Only the bookings that ended since then, not the whole history.
      expect(mockReservationRepository.find).toHaveBeenCalledWith({
        where: {
          end_time: Between(since, now),
          status: Not(ReservationStatus.CANCELLED),
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
