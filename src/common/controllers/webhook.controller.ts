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
          await this.paymentsService.processRefund(
            event.data.object.payment_intent as string,
            event.data.object.amount_refunded / 100,
          );
          break;
      }
    } catch (error) {
      // An event about a payment this application does not know is not an
      // error for the provider: answering 4xx would make it retry for days.
      this.logger.warn(`Stripe event ${event.type} ignored: ${error.message}`);
    }

    return { received: true };
  }
}
