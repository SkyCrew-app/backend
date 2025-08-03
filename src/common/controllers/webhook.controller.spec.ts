jest.mock('stripe', () => {
  const mConstructEvent = jest.fn();
  const StripeMock = jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mConstructEvent },
  }));
  return { default: StripeMock };
});

import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { PaymentsService } from '../../modules/payments/payments.service';
import Stripe from 'stripe';
import { HttpException } from '@nestjs/common';

describe('WebhookController', () => {
  let controller: WebhookController;
  let paymentsService: Partial<PaymentsService>;
  let stripeConstructEvent: jest.Mock;

  const mockEvent = (type: string, obj: any) => ({
    type,
    data: { object: obj },
  });

  beforeEach(async () => {
    // Provide dummy env vars
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    paymentsService = {
      updatePaymentStatus: jest.fn(),
      updateUserBalance: jest.fn(),
      processRefund: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    const stripeInstance = (Stripe as unknown as jest.Mock).mock.results[0]
      .value;
    stripeConstructEvent = stripeInstance.webhooks.constructEvent as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Le controller doit être défini', () => {
    expect(controller).toBeDefined();
  });

  describe('handleStripeWebhook', () => {
    it('doit traiter payment_intent.succeeded', async () => {
      const payload = '{}';
      const signature = 'sig';
      const paymentIntent = {
        metadata: { paymentId: 'p1', userId: '42', amount: '100' },
      };
      const event = mockEvent('payment_intent.succeeded', paymentIntent);

      stripeConstructEvent.mockReturnValue(event);

      const result = await controller.handleStripeWebhook(payload, signature);
      expect(paymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        'p1',
        'completed',
      );
      expect(paymentsService.updateUserBalance).toHaveBeenCalledWith(42, 100);
      expect(result).toEqual({ received: true });
    });

    it('doit traiter payment_intent.payment_failed', async () => {
      const payload = '{}';
      const signature = 'sig';
      const paymentIntent = { metadata: { paymentId: 'p2' } };
      const event = mockEvent('payment_intent.payment_failed', paymentIntent);

      stripeConstructEvent.mockReturnValue(event);

      const result = await controller.handleStripeWebhook(payload, signature);
      expect(paymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        'p2',
        'failed',
      );
      expect(result).toEqual({ received: true });
    });

    it('doit traiter charge.refunded', async () => {
      const payload = '{}';
      const signature = 'sig';
      const charge = { payment_intent: 'pi_123', amount_refunded: 500 };
      const event = mockEvent('charge.refunded', charge);

      stripeConstructEvent.mockReturnValue(event);

      const result = await controller.handleStripeWebhook(payload, signature);
      expect(paymentsService.processRefund).toHaveBeenCalledWith('pi_123', 5);
      expect(result).toEqual({ received: true });
    });

    it('doit renvoyer une erreur 400 si signature invalide', async () => {
      stripeConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(controller.handleStripeWebhook('{}', 'bad')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
