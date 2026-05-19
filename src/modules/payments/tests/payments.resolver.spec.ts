import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsResolver } from '../payments.resolver';
import { PaymentsService } from '../payments.service';
import { CreatePaymentInput } from '../dto/create-payment.input';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

describe('PaymentsResolver', () => {
  let resolver: PaymentsResolver;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let service: PaymentsService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByUser: jest.fn(),
    findByInvoice: jest.fn(),
    processPayment: jest.fn(),
    updatePaymentStatus: jest.fn(),
    processRefund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
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

      const result = await resolver.findOne(id);

      expect(mockService.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(expectedPayment);
    });
  });

  describe('paymentsByUser', () => {
    it('should return payments for a specific user', async () => {
      const userId = 1;
      const expectedPayments = [{ id: 1, amount: 100.0 }];

      mockService.findByUser.mockResolvedValue(expectedPayments);

      const result = await resolver.paymentsByUser(userId);

      expect(mockService.findByUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedPayments);
    });
  });

  describe('paymentsByInvoice', () => {
    it('should return payments for a specific invoice', async () => {
      const invoiceId = 1;
      const expectedPayments = [{ id: 1, amount: 100.0 }];

      mockService.findByInvoice.mockResolvedValue(expectedPayments);

      const result = await resolver.paymentsByInvoice(invoiceId);

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

      const result = await resolver.processPayment(createPaymentInput);

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

      const result = await resolver.processPayment(createPaymentInput);

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

      await expect(resolver.processPayment(createPaymentInput)).rejects.toThrow(
        'User not found for payment',
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
});
