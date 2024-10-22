import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsResolver } from './reservations.resolver';
import { ReservationsService } from './reservations.service';

describe('ReservationsResolver', () => {
  let resolver: ReservationsResolver;
  let reservationService: Partial<ReservationsService>;

  beforeEach(async () => {
    reservationService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findFilteredReservations: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsResolver,
        { provide: ReservationsService, useValue: reservationService },
      ],
    }).compile();

    resolver = module.get<ReservationsResolver>(ReservationsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should create a reservation', async () => {
    const createReservationInput = {
      aircraft_id: 1,
      start_time: new Date(),
      end_time: new Date(),
      user_id: 1,
      reservation_date: new Date(),
    };

    const reservation = { id: 1, ...createReservationInput };

    (reservationService.create as jest.Mock).mockResolvedValue(reservation);

    const result = await resolver.createReservation(createReservationInput);

    expect(reservationService.create).toHaveBeenCalledWith(
      createReservationInput,
    );
    expect(result).toEqual(reservation);
  });

  it('should update a reservation', async () => {
    const updateReservationInput = {
      id: 1,
      aircraft_id: 1,
      start_time: new Date(),
      end_time: new Date(),
    };
    const reservation = { id: 1, ...updateReservationInput };

    (reservationService.update as jest.Mock).mockResolvedValue(reservation);

    const result = await resolver.updateReservation(updateReservationInput);

    expect(reservationService.update).toHaveBeenCalledWith(
      updateReservationInput,
    );
    expect(result).toEqual(reservation);
  });

  it('should delete a reservation', async () => {
    (reservationService.delete as jest.Mock).mockResolvedValue(true);

    const result = await resolver.deleteReservation(1);

    expect(reservationService.delete).toHaveBeenCalledWith(1);
    expect(result).toEqual(true);
  });
});
