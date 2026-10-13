// webhook.controller.ts
import {
  Controller,
  Headers,
  HttpException,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from '../../modules/payments/payments.service';
import Stripe from 'stripe';
import { Public } from '../decorators/public.decorator';
import { stripeClient } from '../../modules/payments/libs/stripe.client';

// Called by the payment provider; authenticated by its signature.
@Public()
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private paymentsService: PaymentsService) {}

  @Post('stripe')
  async handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    let event: Stripe.Event;
    try {
      // The signature covers the body exactly as it was sent.
      event = stripeClient().webhooks.constructEvent(
        request.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new HttpException('Webhook Error', 400);
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.paymentsService.settlePayment(event.data.object.id);
          break;

        case 'payment_intent.payment_failed':
          await this.paymentsService.markPaymentFailed(event.data.object.id);
          break;

        case 'charge.refunded':
          // amount_refunded is the total given back so far, not this refund.
          await this.paymentsService.applyProviderRefund(
            event.data.object.payment_intent as string,
            event.data.object.amount_refunded / 100,
          );
          break;

        case 'charge.dispute.created':
          await this.paymentsService.applyDispute(
            event.data.object.payment_intent as string,
            event.data.object.id,
            event.data.object.amount / 100,
          );
          break;
      }
    } catch (error) {
      // An event this application can do nothing about (a payment it does not
      // know, or one in a state that refuses it) is acknowledged: answering an
      // error would make the provider retry for days.
      if (error instanceof HttpException && error.getStatus() < 500) {
        this.logger.warn(
          `Stripe event ${event.type} ignored: ${error.message}`,
        );
        return { received: true };
      }
      // Anything else (database or provider unreachable) must be retried:
      // the provider does so on a 5xx answer.
      this.logger.error(`Stripe event ${event.type} failed: ${error.message}`);
      throw new HttpException('Webhook processing failed', 500);
    }

    return { received: true };
  }
}
