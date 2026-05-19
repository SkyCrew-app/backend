import { Test, TestingModule } from '@nestjs/testing';
import { PaypalService } from '../libs/paypal.service';
import * as paypal from '@paypal/checkout-server-sdk';

// Mock PayPal SDK
jest.mock('@paypal/checkout-server-sdk');

describe('PaypalService', () => {
  let service: PaypalService;
  let mockClient: jest.Mocked<paypal.core.PayPalHttpClient>;
  let mockOrdersCreateRequest: jest.MockedClass<
    typeof paypal.orders.OrdersCreateRequest
  >;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockClient = {
      execute: jest.fn(),
    } as any;

    // Mock de la classe OrdersCreateRequest
    mockOrdersCreateRequest = jest.fn().mockImplementation(function () {
      this.prefer = jest.fn().mockReturnThis();
      this.requestBody = jest.fn().mockReturnThis();
      return this;
    }) as any;

    (
      paypal.core.PayPalHttpClient as jest.MockedClass<
        typeof paypal.core.PayPalHttpClient
      >
    ).mockImplementation(() => mockClient);

    (paypal.orders.OrdersCreateRequest as jest.MockedClass<
      typeof paypal.orders.OrdersCreateRequest
    >) = mockOrdersCreateRequest;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PaypalService],
    }).compile();

    service = module.get<PaypalService>(PaypalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize PayPal client with sandbox environment', () => {
    expect(paypal.core.SandboxEnvironment).toHaveBeenCalledWith(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET,
    );
    expect(paypal.core.PayPalHttpClient).toHaveBeenCalled();
  });

  describe('createOrder', () => {
    it('should create PayPal order', async () => {
      const amount = 100.5;
      const mockOrderResponse = {
        result: {
          id: 'paypal_order123',
          status: 'CREATED',
        },
      };

      mockClient.execute.mockResolvedValue(mockOrderResponse);

      const result = await service.createOrder(amount);

      expect(mockClient.execute).toHaveBeenCalled();
      expect(result).toEqual(mockOrderResponse);
      expect(mockOrdersCreateRequest).toHaveBeenCalled();
    });

    it('should create order with correct request body format', async () => {
      const amount = 75.0;
      const mockOrderResponse = { result: { id: 'order456' } };

      let capturedRequestBody;
      const mockRequest = {
        prefer: jest.fn().mockReturnThis(),
        requestBody: jest.fn().mockImplementation((body) => {
          capturedRequestBody = body;
        }),
      };

      mockOrdersCreateRequest.mockImplementation(() => mockRequest as any);
      mockClient.execute.mockResolvedValue(mockOrderResponse);

      await service.createOrder(amount);

      expect(capturedRequestBody).toEqual({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'EUR',
              value: '75',
            },
          },
        ],
      });
    });
  });

  describe('capturePayment', () => {
    it('should capture PayPal payment', async () => {
      const orderId = 'paypal_order123';
      const mockCaptureResponse = {
        result: {
          id: orderId,
          status: 'COMPLETED',
        },
      };

      mockClient.execute.mockResolvedValue(mockCaptureResponse);

      const result = await service.capturePayment(orderId);

      expect(mockClient.execute).toHaveBeenCalled();
      expect(result).toEqual(mockCaptureResponse);
      expect(paypal.orders.OrdersCaptureRequest).toHaveBeenCalledWith(orderId);
    });
  });
});
