import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from '../libs/stripe.service';
import Stripe from 'stripe';
import { ServiceUnavailableException } from '@nestjs/common';
import { resetStripeClient, stripeClient } from '../libs/stripe.client';

// Mock Stripe
jest.mock('stripe');

describe('StripeService', () => {
  let service: StripeService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(async () => {
    // Reset the mock and the client built by a previous test
    (Stripe as jest.MockedClass<typeof Stripe>).mockClear();
    resetStripeClient();
    process.env.STRIPE_SECRET_KEY = 'sk_test';

    mockStripe = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    } as any;

    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(
      () => mockStripe,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds the Stripe client on first use, once', () => {
    expect(Stripe).not.toHaveBeenCalled();

    stripeClient();
    stripeClient();

    expect(Stripe).toHaveBeenCalledTimes(1);
    expect(Stripe).toHaveBeenCalledWith('sk_test', {
      apiVersion: '2025-01-27.acacia',
    });
  });

  it('starts without a key and says so when a payment is attempted', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    await expect(service.createPaymentIntent(10)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(Stripe).not.toHaveBeenCalled();
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent with EUR currency by default', async () => {
      const amount = 100.5;
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 10050,
        currency: 'eur',
      };

      (mockStripe.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockPaymentIntent as any,
      );

      const result = await service.createPaymentIntent(amount);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10050, // 100.50 * 100
        currency: 'eur',
        automatic_payment_methods: {
          enabled: true,
        },
      });
      expect(result).toEqual(mockPaymentIntent);
    });

    it('should create payment intent with custom currency', async () => {
      const amount = 75.25;
      const currency = 'usd';
      const mockPaymentIntent = {
        id: 'pi_test456',
        client_secret: 'pi_test456_secret',
        amount: 7525,
        currency: 'usd',
      };

      (mockStripe.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockPaymentIntent as any,
      );

      const result = await service.createPaymentIntent(amount, currency);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 7525, // 75.25 * 100
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      });
      expect(result).toEqual(mockPaymentIntent);
    });

    it('should handle decimal amounts correctly', async () => {
      const amount = 99.99;
      const mockPaymentIntent = { id: 'pi_test789', amount: 9999 };

      (mockStripe.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockPaymentIntent as any,
      );

      await service.createPaymentIntent(amount);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 9999,
        currency: 'eur',
        automatic_payment_methods: {
          enabled: true,
        },
      });
    });
  });

  describe('confirmPayment', () => {
    it('should retrieve payment intent', async () => {
      const paymentIntentId = 'pi_test123';
      const mockPaymentIntent = {
        id: paymentIntentId,
        status: 'succeeded',
        amount: 10050,
      };

      (mockStripe.paymentIntents.retrieve as jest.Mock).mockResolvedValue(
        mockPaymentIntent as any,
      );

      const result = await service.confirmPayment(paymentIntentId);

      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith(
        paymentIntentId,
      );
      expect(result).toEqual(mockPaymentIntent);
    });
  });
});
