import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsResolver } from '../payments.resolver';
import { PaymentsService } from '../payments.service';
import { CreatePaymentInput } from '../dto/create-payment.input';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminActionsService } from '../../../common/admin-actions/admin-actions.service';

const admin = {
  id: 1,
  email: 'admin@example.com',
  role: { role_name: 'Administrateur' },
};
const pilot = {
  id: 3,
  email: 'pilot@example.com',
  role: { role_name: 'Pilote' },
};

describe('PaymentsResolver', () => {
  let resolver: PaymentsResolver;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let service: PaymentsService;

  const trace = { record: jest.fn() };

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByUser: jest.fn(),
    findByInvoice: jest.fn(),
    processPayment: jest.fn(),
    updatePaymentStatus: jest.fn(),
    settlePayment: jest.fn(),
    processRefund: jest.fn(),
    adjustBalance: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminActionsService, useValue: trace },
        PaymentsResolver,
        {
          provide: PaymentsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<PaymentsResolver>(PaymentsResolver);
    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createPayment', () => {
    it('should create a payment', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 100.0,
        payment_method: 'stripe',
      };

      const expectedPayment = { id: 1, ...createPaymentInput };
      mockService.create.mockResolvedValue(expectedPayment);

      const result = await resolver.createPayment(createPaymentInput);

      expect(mockService.create).toHaveBeenCalledWith(createPaymentInput);
      expect(result).toEqual(expectedPayment);
    });
  });

  describe('findAll', () => {
    it('should return all payments', async () => {
      const expectedPayments = [
        { id: 1, amount: 100.0 },
        { id: 2, amount: 200.0 },
      ];

      mockService.findAll.mockResolvedValue(expectedPayments);

      const result = await resolver.findAll();

      expect(mockService.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedPayments);
    });
  });

  describe('findOne', () => {
    it('should return a payment by id', async () => {
      const id = 1;
      const expectedPayment = { id, amount: 100.0 };

      mockService.findOne.mockResolvedValue(expectedPayment);

      const result = await resolver.findOne(id, admin);

      expect(mockService.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(expectedPayment);
    });
  });

  describe('paymentsByUser', () => {
    it('should return payments for a specific user', async () => {
      const userId = 1;
      const expectedPayments = [{ id: 1, amount: 100.0 }];

      mockService.findByUser.mockResolvedValue(expectedPayments);

      const result = await resolver.paymentsByUser(userId, admin);

      expect(mockService.findByUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedPayments);
    });
  });

  describe('paymentsByInvoice', () => {
    it('should return payments for a specific invoice', async () => {
      const invoiceId = 1;
      const expectedPayments = [{ id: 1, amount: 100.0 }];

      mockService.findByInvoice.mockResolvedValue(expectedPayments);

      const result = await resolver.paymentsByInvoice(invoiceId, admin);

      expect(mockService.findByInvoice).toHaveBeenCalledWith(invoiceId);
      expect(result).toEqual(expectedPayments);
    });
  });

  describe('processPayment', () => {
    it('should process payment and return PaymentResult', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 100.0,
        payment_method: 'stripe',
      };

      const mockPayment = {
        id: 1,
        amount: 100.0,
        payment_method: 'stripe',
        payment_status: 'pending',
        external_payment_id: 'pi_test123',
        payment_details: JSON.stringify({ client_secret: 'pi_test123_secret' }),
        user: { id: 1, name: 'Test User' },
      };

      mockService.processPayment.mockResolvedValue(mockPayment);

      const result = await resolver.processPayment(createPaymentInput, admin);

      expect(mockService.processPayment).toHaveBeenCalledWith(
        createPaymentInput,
      );
      expect(result).toEqual({
        id: 1,
        amount: 100.0,
        payment_method: 'stripe',
        payment_status: 'pending',
        external_payment_id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        user: mockPayment.user,
      });
    });

    it('should handle missing payment details', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 100.0,
        payment_method: 'paypal',
      };

      const mockPayment = {
        id: 1,
        amount: 100.0,
        payment_method: 'paypal',
        payment_status: 'pending',
        external_payment_id: 'paypal_order123',
        payment_details: null,
        user: { id: 1, name: 'Test User' },
      };

      mockService.processPayment.mockResolvedValue(mockPayment);

      const result = await resolver.processPayment(createPaymentInput, admin);

      expect(result.client_secret).toBeNull();
    });

    it('should throw error if user not found', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 100.0,
        payment_method: 'stripe',
      };

      const mockPayment = {
        id: 1,
        amount: 100.0,
        payment_method: 'stripe',
        payment_status: 'pending',
        external_payment_id: 'pi_test123',
        payment_details: null,
        user: null,
      };

      mockService.processPayment.mockResolvedValue(mockPayment);

      await expect(
        resolver.processPayment(createPaymentInput, admin),
      ).rejects.toThrow('User not found for payment');
    });
  });

  describe('confirmPayment', () => {
    it('settles the payment on behalf of the caller', async () => {
      const caller = { id: 3, email: 'p@example.com', role: 'Pilote' };
      const settled = { id: 1, payment_status: 'completed' };
      mockService.settlePayment.mockResolvedValue(settled);

      await expect(resolver.confirmPayment('pi_test123', caller)).resolves.toBe(
        settled,
      );
      expect(mockService.settlePayment).toHaveBeenCalledWith(
        'pi_test123',
        caller,
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      const paymentId = 'pi_test123';
      const status = 'completed';
      const expectedPayment = {
        id: 1,
        external_payment_id: paymentId,
        payment_status: status,
      };

      mockService.updatePaymentStatus.mockResolvedValue(expectedPayment);

      const result = await resolver.updatePaymentStatus(paymentId, status);

      expect(mockService.updatePaymentStatus).toHaveBeenCalledWith(
        paymentId,
        status,
      );
      expect(result).toEqual(expectedPayment);
    });
  });

  describe('processRefund', () => {
    it('should process refund', async () => {
      const paymentIntentId = 'pi_test123';
      const amount = 50.0;
      const expectedPayment = {
        id: 1,
        external_payment_id: paymentIntentId,
        payment_status: 'refunded',
      };

      mockService.processRefund.mockResolvedValue(expectedPayment);

      const result = await resolver.processRefund(paymentIntentId, amount);

      expect(mockService.processRefund).toHaveBeenCalledWith(
        paymentIntentId,
        amount,
      );
      expect(result).toEqual(expectedPayment);
    });
  });
  describe('authorization', () => {
    it('refuses a member reading the payments of another user', async () => {
      expect(() => resolver.paymentsByUser(7, pilot)).toThrow(
        ForbiddenException,
      );
      expect(mockService.findByUser).not.toHaveBeenCalled();
    });

    it('lets a member read their own payments', async () => {
      mockService.findByUser.mockResolvedValue([{ id: 1 }]);

      await expect(resolver.paymentsByUser(3, pilot)).resolves.toEqual([
        { id: 1 },
      ]);
    });

    it('refuses a member reading a payment that belongs to someone else', async () => {
      mockService.findOne.mockResolvedValue({ id: 9, user: { id: 7 } });

      await expect(resolver.findOne(9, pilot)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets a member read one of their own payments', async () => {
      const payment = { id: 9, user: { id: 3 } };
      mockService.findOne.mockResolvedValue(payment);

      await expect(resolver.findOne(9, pilot)).resolves.toBe(payment);
    });

    it('only shows a member their own payments on an invoice', async () => {
      mockService.findByInvoice.mockResolvedValue([
        { id: 1, user: { id: 3 } },
        { id: 2, user: { id: 7 } },
      ]);

      await expect(resolver.paymentsByInvoice(5, pilot)).resolves.toEqual([
        { id: 1, user: { id: 3 } },
      ]);
    });

    it('starts a top-up for the session user, whatever user id is sent', async () => {
      mockService.processPayment.mockResolvedValue({
        id: 1,
        amount: 50,
        payment_method: 'stripe',
        payment_status: 'pending',
        external_payment_id: 'pi_1',
        payment_details: null,
        user: { id: 3 },
      });

      await resolver.processPayment(
        { user_id: 7, amount: 50, payment_method: 'stripe' },
        pilot,
      );

      expect(mockService.processPayment).toHaveBeenCalledWith({
        user_id: 3,
        amount: 50,
        payment_method: 'stripe',
      });
    });

    it('lets an administrator start a payment for another user', async () => {
      mockService.processPayment.mockResolvedValue({
        id: 1,
        amount: 50,
        payment_method: 'stripe',
        payment_status: 'pending',
        external_payment_id: 'pi_1',
        payment_details: null,
        user: { id: 7 },
      });

      await resolver.processPayment(
        { user_id: 7, amount: 50, payment_method: 'stripe' },
        admin,
      );

      expect(mockService.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 7 }),
      );
    });
  });

  describe('adjustMemberBalance', () => {
    const input = {
      user_id: 3,
      amount: 250,
      credit: true,
      payment_method: 'cheque',
      reason: 'Chèque n° 1234',
    };

    it('is reserved to administrators', () => {
      expect(
        Reflect.getMetadata(
          'roles',
          PaymentsResolver.prototype.adjustMemberBalance,
        ),
      ).toEqual(['Administrateur']);
      const guards = Reflect.getMetadata(
        '__guards__',
        PaymentsResolver.prototype.adjustMemberBalance,
      );
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('records the administrator of the session, not one named by the caller', async () => {
      const administrator = {
        id: 1,
        email: 'admin@test.com',
        role: { role_name: 'Administrateur' },
      };
      mockService.adjustBalance.mockResolvedValue({ id: 8 });

      await resolver.adjustMemberBalance(input, administrator);

      expect(mockService.adjustBalance).toHaveBeenCalledWith(
        input,
        administrator,
      );
    });
  });

  describe('trace of administrator actions', () => {
    const administrator = {
      id: 1,
      email: 'admin@club.fr',
      role: 'Administrateur',
    };

    it('records a manual entry with its amount, direction, method and reason', async () => {
      mockService.adjustBalance.mockResolvedValue({
        id: 44,
        user: { id: 3, first_name: 'Jean', last_name: 'Dupont' },
      });

      await resolver.adjustMemberBalance(
        {
          user_id: 3,
          amount: 250,
          credit: false,
          payment_method: 'correction',
          reason: 'Erreur de saisie',
        },
        administrator,
      );

      expect(trace.record).toHaveBeenCalledWith(
        administrator,
        'balance.adjusted',
        { type: 'member', id: 3, label: 'Jean Dupont' },
        {
          paymentId: 44,
          direction: 'debit',
          amount: 250,
          method: 'correction',
          reason: 'Erreur de saisie',
        },
      );
    });

    it('records nothing when the entry is refused', async () => {
      mockService.adjustBalance.mockRejectedValue(new Error('refused'));

      await expect(
        resolver.adjustMemberBalance({ user_id: 3 } as any, administrator),
      ).rejects.toThrow('refused');
      expect(trace.record).not.toHaveBeenCalled();
    });

    it('records a payment status set by hand and a refund recorded by hand', async () => {
      mockService.updatePaymentStatus.mockResolvedValue({
        id: 9,
        payment_status: 'cancelled',
        amount: 50,
        user: { id: 3 },
      });
      mockService.processRefund.mockResolvedValue({
        id: 9,
        refunded_amount: 20,
        user: { id: 3 },
      });

      await resolver.updatePaymentStatus('pi_1', 'cancelled', administrator);
      await resolver.processRefund('pi_1', 20, administrator);

      expect(
        trace.record.mock.calls.map(([, action, target, summary]) => [
          action,
          target,
          summary,
        ]),
      ).toEqual([
        [
          'payment.status_changed',
          { type: 'payment', id: 9 },
          {
            requested: 'cancelled',
            status: 'cancelled',
            memberId: 3,
            amount: 50,
          },
        ],
        [
          'payment.refund_recorded',
          { type: 'payment', id: 9 },
          { amount: 20, refundedInTotal: 20, memberId: 3 },
        ],
      ]);
    });
  });
});
