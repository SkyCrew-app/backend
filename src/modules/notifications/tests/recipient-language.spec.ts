import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { translationOf } from '../../../common/i18n/localized-exception';
import { FlightsService } from '../../flights/flights.service';
import { InstructionCoursesService } from '../../instruction-courses/instruction-courses.service';
import { PaymentsService } from '../../payments/payments.service';

// Notifications created outside the cron jobs and the reservations: each one
// is written in the stored language of the member who receives it.
describe('notifications in the language of their recipient', () => {
  let notifications: { create: jest.Mock };

  const sent = () =>
    notifications.create.mock.calls.map(([notification]) => [
      notification.user_id,
      notification.notification_type,
      notification.message,
    ]);

  beforeEach(() => {
    notifications = { create: jest.fn() };
  });

  describe('flight plans', () => {
    let service: FlightsService;

    beforeEach(() => {
      service = new FlightsService(
        { save: jest.fn().mockImplementation(async (flight) => flight) } as any,
        { findOne: jest.fn() } as any,
        notifications as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    const input = () =>
      ({ user_id: 2, origin_icao: 'LFPG', destination_icao: 'EGLL' }) as any;

    it('keeps the French wording by default', async () => {
      await service.createFlightByUser(input());

      expect(sent()).toEqual([
        [2, 'FLIGHT_CREATED', 'Votre plan de vol de LFPG a EGLL a ete cree'],
      ]);
    });

    it('is announced in English to an English-speaking pilot', async () => {
      await service.createFlightByUser(input(), 'en');

      expect(sent()).toEqual([
        [
          2,
          'FLIGHT_CREATED',
          'Your flight plan from LFPG to EGLL has been created',
        ],
      ]);
    });

    it('refuses to close a flight twice with a translatable message', async () => {
      (service as any).flightsRepository.findOne = jest
        .fn()
        .mockResolvedValue({ id: 1, user: { id: 2 }, closed_at: new Date() });

      const error = await service
        .updateFlight(1, { id: 1, closed: true } as any, { id: 2 } as any)
        .catch((thrown) => thrown);

      expect(error.message).toBe('Ce vol est déjà clôturé');
      expect(translationOf(error)?.key).toBe('error.flight.alreadyClosed');
    });
  });

  describe('payments', () => {
    let service: PaymentsService;
    let paymentsRepository: any;
    let userRepository: any;

    beforeEach(() => {
      paymentsRepository = {
        findOne: jest.fn(),
        create: jest.fn().mockImplementation((payment) => payment),
        save: jest.fn().mockImplementation(async (payment) => payment),
        update: jest.fn(),
      };
      userRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      };
      service = new PaymentsService(
        paymentsRepository,
        {} as any,
        {} as any,
        userRepository,
        { save: jest.fn().mockResolvedValue({ id: 8 }) } as any,
        notifications as any,
      );
    });

    it.each([
      ['fr', 'Une facture de 50 a été créée'],
      ['en', 'An invoice of 50 has been created'],
    ])(
      'announces an invoice to a member whose language is %s',
      async (language, message) => {
        await service.createInvoice({
          amount: 50,
          user: { id: 4, language },
        } as any);

        expect(sent()).toEqual([[4, 'INVOICE_CREATED', message]]);
      },
    );

    it('announces a refund in English to an English-speaking member', async () => {
      paymentsRepository.findOne.mockResolvedValue({
        id: 1,
        amount: 30,
        user: { id: 4, language: 'en', user_account_balance: 100 },
      });
      userRepository.findOne.mockResolvedValue({
        id: 4,
        language: 'en',
        user_account_balance: 100,
      });

      await service.refund(4, 30);

      expect(sent()).toEqual([
        [4, 'PAYMENT_REFUNDED', 'A refund of 30 has been made to your account'],
      ]);
    });

    it('refuses with translatable messages', async () => {
      userRepository.findOne.mockResolvedValue({ id: 4 });
      const outOfRange = await service
        .processPayment({ user_id: 4, amount: 0 } as any)
        .catch((thrown) => thrown);

      expect(outOfRange).toBeInstanceOf(BadRequestException);
      expect(outOfRange.message).toBe(
        'Le montant doit être compris entre 1 et 5000 euros',
      );
      expect(translationOf(outOfRange)).toEqual({
        key: 'error.payment.amountOutOfRange',
        params: { min: 1, max: 5000 },
      });

      paymentsRepository.findOne.mockResolvedValue({
        id: 1,
        user: { id: 9 },
        payment_status: 'pending',
      });
      const notOwn = await service
        .settlePayment('pi_1', { id: 4 } as any)
        .catch((thrown) => thrown);

      expect(notOwn).toBeInstanceOf(ForbiddenException);
      expect(translationOf(notOwn)?.key).toBe('error.payment.notOwnPayment');
    });
  });

  describe('instruction courses', () => {
    let service: InstructionCoursesService;
    let courseRepository: any;
    let competencyRepository: any;
    let commentRepository: any;
    let usersService: { findOneById: jest.Mock };

    beforeEach(() => {
      courseRepository = {
        findOne: jest.fn(),
        create: jest.fn().mockImplementation((course) => course),
        save: jest.fn().mockImplementation(async (course) => course),
      };
      competencyRepository = {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation(async (competency) => competency),
      };
      commentRepository = {
        create: jest.fn().mockImplementation((comment) => comment),
        save: jest.fn().mockImplementation(async (comment) => comment),
        findOne: jest.fn(),
      };
      usersService = { findOneById: jest.fn() };
      service = new InstructionCoursesService(
        courseRepository,
        competencyRepository,
        commentRepository,
        {} as any,
        {} as any,
        usersService as any,
        notifications as any,
        {} as any,
      );
    });

    it('announces a new course to each of them in their own language', async () => {
      courseRepository.findOne.mockResolvedValue(null);
      usersService.findOneById.mockImplementation(async (id: number) =>
        id === 20 ? { id: 20, language: 'en' } : { id: 10, language: 'fr' },
      );

      await service.createCourse({
        instructorId: 20,
        studentId: 10,
        startTime: new Date(2026, 5, 1, 8),
        endTime: new Date(2026, 5, 1, 10),
      } as any);

      expect(sent()).toEqual([
        [10, 'COURSE_CREATED', "Votre cours avec l'instructeur 20 a été créé."],
        [20, 'COURSE_CREATED', 'Your course with student 10 has been created.'],
      ]);
    });

    it('announces a validated skill and a comment in English to an English-speaking student', async () => {
      const student = { id: 10, language: 'en' };
      competencyRepository.findOne.mockResolvedValue({
        id: 1,
        course: { student },
      });
      courseRepository.findOne.mockResolvedValue({ id: 3, student });

      await service.validateCompetency(1);
      await service.addComment({ courseId: 3, author: 20, content: 'ok' });

      expect(sent()).toEqual([
        [
          10,
          'COMPETENCY_VALIDATED',
          'A skill has been validated in your course.',
        ],
        [10, 'COURSE_COMMENT', 'A comment has been added to your course.'],
      ]);
    });
  });
});
