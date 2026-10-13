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
import {
  resetStripeClient,
  stripeClient,
} from '../../modules/payments/libs/stripe.client';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';

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
      settlePayment: jest.fn(),
      markPaymentFailed: jest.fn(),
      updateUserBalance: jest.fn(),
      applyProviderRefund: jest.fn(),
      applyDispute: jest.fn(),
      applyDisputeWon: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    // The client is built on first use.
    (Stripe as unknown as jest.Mock).mockClear();
    resetStripeClient();
    const stripeInstance = stripeClient();
    stripeConstructEvent = stripeInstance.webhooks.constructEvent as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Le controller doit être défini', () => {
    expect(controller).toBeDefined();
  });

  describe('handleStripeWebhook', () => {
    const RAW = Buffer.from('{"id":"evt_1"}');
    const request = { rawBody: RAW } as any;

    it('checks the signature against the body exactly as it was sent', async () => {
      stripeConstructEvent.mockReturnValue(mockEvent('ping', {}));

      await controller.handleStripeWebhook(request, 'sig');

      expect(stripeConstructEvent).toHaveBeenCalledWith(
        RAW,
        'sig',
        'whsec_test',
      );
    });

    it('settles the payment when the intent succeeds, without crediting itself', async () => {
      stripeConstructEvent.mockReturnValue(
        mockEvent('payment_intent.succeeded', { id: 'pi_1' }),
      );

      const result = await controller.handleStripeWebhook(request, 'sig');

      expect(paymentsService.settlePayment).toHaveBeenCalledWith('pi_1');
      expect(paymentsService.updateUserBalance).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('records a failed attempt', async () => {
      stripeConstructEvent.mockReturnValue(
        mockEvent('payment_intent.payment_failed', { id: 'pi_2' }),
      );

      const result = await controller.handleStripeWebhook(request, 'sig');

      expect(paymentsService.markPaymentFailed).toHaveBeenCalledWith('pi_2');
      expect(result).toEqual({ received: true });
    });

    it('passes on the total refunded so far, as the provider announces it', async () => {
      stripeConstructEvent.mockReturnValue(
        mockEvent('charge.refunded', {
          payment_intent: 'pi_123',
          amount_refunded: 500,
        }),
      );

      const result = await controller.handleStripeWebhook(request, 'sig');

      expect(paymentsService.applyProviderRefund).toHaveBeenCalledWith(
        'pi_123',
        5,
      );
      expect(result).toEqual({ received: true });
    });

    it('records a chargeback', async () => {
      stripeConstructEvent.mockReturnValue(
        mockEvent('charge.dispute.created', {
          id: 'dp_1',
          payment_intent: 'pi_123',
          amount: 50000,
        }),
      );

      await controller.handleStripeWebhook(request, 'sig');

      expect(paymentsService.applyDispute).toHaveBeenCalledWith(
        'pi_123',
        'dp_1',
        500,
      );
    });

    it('gives the money back when a chargeback is closed in favour of the club', async () => {
      stripeConstructEvent.mockReturnValue(
        mockEvent('charge.dispute.closed', {
          id: 'dp_1',
          payment_intent: 'pi_123',
          amount: 50000,
          status: 'won',
        }),
      );

      await controller.handleStripeWebhook(request, 'sig');

      expect(paymentsService.applyDisputeWon).toHaveBeenCalledWith('dp_1');
    });

    it.each(['lost', 'warning_closed', 'charge_refunded'])(
      'gives nothing back when a chargeback is closed as %s',
      async (status) => {
        stripeConstructEvent.mockReturnValue(
          mockEvent('charge.dispute.closed', { id: 'dp_1', status }),
        );

        await expect(
          controller.handleStripeWebhook(request, 'sig'),
        ).resolves.toEqual({ received: true });
        expect(paymentsService.applyDisputeWon).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        'a payment it does not know',
        new NotFoundException('Payment not found'),
      ],
      ['a payment that refuses it', new BadRequestException('Not confirmable')],
    ])('acknowledges an event about %s', async (_case, refusal) => {
      stripeConstructEvent.mockReturnValue(
        mockEvent('payment_intent.succeeded', { id: 'pi_unknown' }),
      );
      (paymentsService.settlePayment as jest.Mock).mockRejectedValue(refusal);

      await expect(
        controller.handleStripeWebhook(request, 'sig'),
      ).resolves.toEqual({ received: true });
    });

    // Answering 200 here would tell the provider not to retry: a top-up paid
    // while the database was unreachable would never be credited.
    it('answers 500 when crediting fails, so the provider retries', async () => {
      stripeConstructEvent.mockReturnValue(
        mockEvent('payment_intent.succeeded', { id: 'pi_1' }),
      );
      (paymentsService.settlePayment as jest.Mock).mockRejectedValue(
        new Error('connection terminated'),
      );

      const error = await controller
        .handleStripeWebhook(request, 'sig')
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(500);
    });

    it('answers 400 when the signature is invalid', async () => {
      stripeConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        controller.handleStripeWebhook(request, 'bad'),
      ).rejects.toThrow(HttpException);
      expect(paymentsService.settlePayment).not.toHaveBeenCalled();
    });
  });
});
