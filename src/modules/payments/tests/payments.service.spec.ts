/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from '../payments.service';
import { Payment } from '../entity/payments.entity';
import { User } from '../../users/entity/users.entity';
import { Invoice } from '../../invoices/entity/invoices.entity';
import { StripeService } from '../libs/stripe.service';
import { PaypalService } from '../libs/paypal.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreatePaymentInput } from '../dto/create-payment.input';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let userRepository: Repository<User>;
  let invoiceRepository: Repository<Invoice>;
  let stripeService: StripeService;
  let paypalService: PaypalService;
  let notificationsService: NotificationsService;

  const mockPaymentsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockInvoiceRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockStripeService = {
    createPaymentIntent: jest.fn(),
    confirmPayment: jest.fn(),
  };

  const mockPaypalService = {
    createOrder: jest.fn(),
    capturePayment: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentsRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockInvoiceRepository,
        },
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
        {
          provide: PaypalService,
          useValue: mockPaypalService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    invoiceRepository = module.get<Repository<Invoice>>(
      getRepositoryToken(Invoice),
    );
    stripeService = module.get<StripeService>(StripeService);
    paypalService = module.get<PaypalService>(PaypalService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new payment with pending status', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 100.5,
        payment_method: 'stripe',
      };

      const expectedPayment = {
        ...createPaymentInput,
        payment_date: expect.any(Date),
        payment_status: 'pending',
      };

      const savedPayment = { id: 1, ...expectedPayment };

      mockPaymentsRepository.create.mockReturnValue(expectedPayment);
      mockPaymentsRepository.save.mockResolvedValue(savedPayment);

      const result = await service.create(createPaymentInput);

      expect(mockPaymentsRepository.create).toHaveBeenCalledWith(
        expectedPayment,
      );
      expect(mockPaymentsRepository.save).toHaveBeenCalledWith(expectedPayment);
      expect(result).toEqual(savedPayment);
    });
  });

  describe('createWithdrawal', () => {
    it('should create withdrawal and update user balance', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 50.0,
        payment_method: 'withdrawal',
      };

      const mockUser = { id: 1, user_account_balance: 100.0 };
      const mockInvoice = { id: 1, amount: 50.0 };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockInvoiceRepository.save.mockResolvedValue(mockInvoice);
      mockPaymentsRepository.create.mockReturnValue({
        ...createPaymentInput,
        user: mockUser,
        payment_date: expect.any(Date),
        payment_status: 'completed',
      });
      mockPaymentsRepository.save.mockResolvedValue({
        id: 1,
        ...createPaymentInput,
        invoice: mockInvoice,
      });

      jest
        .spyOn(service, 'updateUserBalance')
        .mockResolvedValue(mockUser as any);

      const result = await service.createWithdrawal(createPaymentInput);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: createPaymentInput.user_id },
      });
      expect(service.updateUserBalance).toHaveBeenCalledWith(1, -50.0);
      expect(mockNotificationsService.create).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('should throw error if user not found', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 999,
        amount: 50.0,
        payment_method: 'withdrawal',
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createWithdrawal(createPaymentInput),
      ).rejects.toThrow('User with ID 999 not found');
    });
  });

  describe('findAll', () => {
    it('should return all payments with relations', async () => {
      const mockPayments = [
        { id: 1, amount: 100.0 },
        { id: 2, amount: 200.0 },
      ];

      mockPaymentsRepository.find.mockResolvedValue(mockPayments);

      const result = await service.findAll();

      expect(mockPaymentsRepository.find).toHaveBeenCalledWith({
        relations: ['user', 'invoice'],
      });
      expect(result).toEqual(mockPayments);
    });
  });

  describe('findOne', () => {
    it('should return a payment by id with relations', async () => {
      const id = 1;
      const mockPayment = { id, amount: 100.0 };

      mockPaymentsRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne(id);

      expect(mockPaymentsRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['user', 'invoice'],
      });
      expect(result).toEqual(mockPayment);
    });
  });

  describe('findByUser', () => {
    it('should return payments for a specific user', async () => {
      const userId = 1;
      const mockPayments = [{ id: 1, amount: 100.0 }];

      mockPaymentsRepository.find.mockResolvedValue(mockPayments);

      const result = await service.findByUser(userId);

      expect(mockPaymentsRepository.find).toHaveBeenCalledWith({
        where: { user: { id: userId } },
        relations: ['invoice', 'user'],
      });
      expect(result).toEqual(mockPayments);
    });
  });

  describe('findByInvoice', () => {
    it('should return payments for a specific invoice', async () => {
      const invoiceId = 1;
      const mockPayments = [{ id: 1, amount: 100.0 }];

      mockPaymentsRepository.find.mockResolvedValue(mockPayments);

      const result = await service.findByInvoice(invoiceId);

      expect(mockPaymentsRepository.find).toHaveBeenCalledWith({
        where: { invoice: { id: invoiceId } },
        relations: ['user'],
      });
      expect(result).toEqual(mockPayments);
    });
  });

  describe('processPayment', () => {
    it('should process Stripe payment', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 100.0,
        payment_method: 'stripe',
      };

      const mockUser = { id: 1, name: 'Test User' };
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockStripeService.createPaymentIntent.mockResolvedValue(
        mockPaymentIntent,
      );

      const expectedPayment = {
        ...createPaymentInput,
        payment_date: expect.any(Date),
        payment_status: 'pending',
        external_payment_id: 'pi_test123',
        payment_details: JSON.stringify({
          id: 'pi_test123',
          client_secret: 'pi_test123_secret',
        }),
        user: mockUser,
      };

      mockPaymentsRepository.create.mockReturnValue(expectedPayment);
      mockPaymentsRepository.save.mockResolvedValue({
        id: 1,
        ...expectedPayment,
      });

      const result = await service.processPayment(createPaymentInput);

      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(100.0);
      expect(mockPaymentsRepository.create).toHaveBeenCalledWith(
        expectedPayment,
      );
      expect(result.id).toBe(1);
    });

    it('should process PayPal payment', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 100.0,
        payment_method: 'paypal',
      };

      const mockUser = { id: 1, name: 'Test User' };
      const mockPaypalOrder = { result: { id: 'paypal_order123' } };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPaypalService.createOrder.mockResolvedValue(mockPaypalOrder);

      const expectedPayment = {
        ...createPaymentInput,
        payment_date: expect.any(Date),
        payment_status: 'pending',
        external_payment_id: 'paypal_order123',
        payment_details: JSON.stringify({ id: 'paypal_order123' }),
        user: mockUser,
      };

      mockPaymentsRepository.create.mockReturnValue(expectedPayment);
      mockPaymentsRepository.save.mockResolvedValue({
        id: 1,
        ...expectedPayment,
      });

      const result = await service.processPayment(createPaymentInput);

      expect(mockPaypalService.createOrder).toHaveBeenCalledWith(100.0);
      expect(result.id).toBe(1);
    });

    it('should throw error for unsupported payment method', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 1,
        amount: 100.0,
        payment_method: 'unsupported',
      };

      const mockUser = { id: 1, name: 'Test User' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.processPayment(createPaymentInput)).rejects.toThrow(
        'Payment method not supported',
      );
    });

    it('should throw error if user not found', async () => {
      const createPaymentInput: CreatePaymentInput = {
        user_id: 999,
        amount: 100.0,
        payment_method: 'stripe',
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.processPayment(createPaymentInput)).rejects.toThrow(
        'User with ID 999 not found',
      );
    });
  });

  describe('updateUserBalance', () => {
    it('should update user balance correctly', async () => {
      const userId = 1;
      const amount = 50.25;
      const mockUser = { id: 1, user_account_balance: 100.0 };
      const updatedUser = { ...mockUser, user_account_balance: 150.25 };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateUserBalance(userId, amount);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        user_account_balance: 150.25,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUserBalance(999, 50.0)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw error for invalid amount', async () => {
      const mockUser = { id: 1, user_account_balance: 100.0 };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.updateUserBalance(1, NaN)).rejects.toThrow(
        'Invalid amount',
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status to completed and process balance update', async () => {
      const paymentId = 'pi_test123';
      const status = 'completed';
      const mockPayment = {
        id: 1,
        external_payment_id: paymentId,
        payment_method: 'stripe',
        payment_status: 'pending',
        amount: 100.0,
        user: { id: 1 },
      };

      const mockInvoice = { id: 1 };

      mockPaymentsRepository.findOne.mockResolvedValue(mockPayment);
      mockInvoiceRepository.findOne.mockResolvedValue(mockInvoice);
      mockPaymentsRepository.save.mockResolvedValue({
        ...mockPayment,
        payment_status: 'completed',
        invoice: mockInvoice,
      });

      jest.spyOn(service, 'updateUserBalance').mockResolvedValue({} as any);
      jest.spyOn(service, 'createInvoice').mockResolvedValue(1);

      const result = await service.updatePaymentStatus(paymentId, status);

      expect(mockStripeService.confirmPayment).toHaveBeenCalledWith(paymentId);
      expect(service.updateUserBalance).toHaveBeenCalledWith(1, 100.0);
      expect(service.createInvoice).toHaveBeenCalledWith(mockPayment);
      expect(mockNotificationsService.create).toHaveBeenCalled();
      expect(result.payment_status).toBe('completed');
    });

    it('should handle PayPal payment completion', async () => {
      const paymentId = 'paypal_order123';
      const status = 'completed';
      const mockPayment = {
        id: 1,
        external_payment_id: paymentId,
        payment_method: 'paypal',
        payment_status: 'pending',
        amount: 100.0,
        user: { id: 1 },
      };

      mockPaymentsRepository.findOne.mockResolvedValue(mockPayment);
      mockPaymentsRepository.save.mockResolvedValue({
        ...mockPayment,
        payment_status: 'completed',
      });

      jest.spyOn(service, 'updateUserBalance').mockResolvedValue({} as any);
      jest.spyOn(service, 'createInvoice').mockResolvedValue(1);

      await service.updatePaymentStatus(paymentId, status);

      expect(mockPaypalService.capturePayment).toHaveBeenCalledWith(paymentId);
    });

    it('should throw error if payment not found', async () => {
      mockPaymentsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePaymentStatus('nonexistent', 'completed'),
      ).rejects.toThrow('Payment not found');
    });
  });

  describe('processRefund', () => {
    it('should process refund successfully', async () => {
      const paymentIntentId = 'pi_test123';
      const amount = 50.0;
      const mockPayment = {
        id: 1,
        external_payment_id: paymentIntentId,
        payment_status: 'completed',
        amount: 100.0,
        user: { id: 1 },
      };

      mockPaymentsRepository.findOne.mockResolvedValue(mockPayment);
      mockPaymentsRepository.save.mockResolvedValue({
        ...mockPayment,
        payment_status: 'refunded',
      });

      jest.spyOn(service, 'updateUserBalance').mockResolvedValue({} as any);

      const result = await service.processRefund(paymentIntentId, amount);

      expect(service.updateUserBalance).toHaveBeenCalledWith(1, -amount);
      expect(mockNotificationsService.create).toHaveBeenCalled();
      expect(result.payment_status).toBe('refunded');
    });

    it('should throw error if payment not found for refund', async () => {
      mockPaymentsRepository.findOne.mockResolvedValue(null);

      await expect(service.processRefund('nonexistent', 50.0)).rejects.toThrow(
        'Payment not found',
      );
    });
  });

  describe('refund', () => {
    it('should refund payment by user and amount', async () => {
      const userId = 1;
      const amount = 100.0;
      const mockPayment = {
        id: 1,
        amount,
        payment_status: 'completed',
        user: { id: userId },
      };

      mockPaymentsRepository.findOne.mockResolvedValue(mockPayment);
      mockPaymentsRepository.save.mockResolvedValue({
        ...mockPayment,
        payment_status: 'refunded',
      });

      jest.spyOn(service, 'updateUserBalance').mockResolvedValue({} as any);

      const result = await service.refund(userId, amount);

      expect(mockPaymentsRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: userId }, amount },
        relations: ['user'],
      });
      expect(service.updateUserBalance).toHaveBeenCalledWith(userId, -amount);
      expect(result.payment_status).toBe('refunded');
    });
  });
});
