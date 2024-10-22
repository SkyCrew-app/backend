import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reservation } from './entity/reservations.entity';
import { Repository } from 'typeorm';
import { MailerService } from '../mail/mailer.service';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let repository: Repository<Reservation>;

  const mockReservationRepository = {
    find: jest
      .fn()
      .mockResolvedValue([
        { id: 1, start_time: '2023-10-20', end_time: '2023-10-21' },
      ]),
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      start_time: '2023-10-20',
      end_time: '2023-10-21',
    }),
    save: jest.fn().mockResolvedValue({
      id: 1,
      start_time: '2023-10-20',
      end_time: '2023-10-21',
    }),
  };

  const mockMailerService = {
    sendMail: jest.fn().mockResolvedValue(true),
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
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    repository = module.get<Repository<Reservation>>(
      getRepositoryToken(Reservation),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a list of reservations', async () => {
    const result = await service.findAll();
    expect(result).toEqual([
      { id: 1, start_time: '2023-10-20', end_time: '2023-10-21' },
    ]);
  });

  it('should return a single reservation by ID', async () => {
    const result = await service.findOne(1);
    expect(result).toEqual({
      id: 1,
      start_time: '2023-10-20',
      end_time: '2023-10-21',
    });
    expect(mockReservationRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  // it('should create a new reservation', async () => {
  //   const newReservation = { start_time: '2023-10-22', end_time: '2023-10-23' };
  //   const result = await service.create(newReservation);
  //   expect(result).toEqual({
  //     id: 1,
  //     start_time: '2023-10-20',
  //     end_time: '2023-10-21',
  //   });
  //   expect(mockReservationRepository.save).toHaveBeenCalledWith(newReservation);
  // });

  // it('should send an email upon successful reservation creation', async () => {
  //   await service.sendReservationConfirmationEmail(
  //     { email: 'user@example.com' },
  //     { id: 1 },
  //   );
  //   expect(mockMailerService.sendMail).toHaveBeenCalled();
  // });
});
