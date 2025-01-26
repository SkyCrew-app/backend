// webhook.controller.ts
import { Controller, Post, Body, Headers, HttpException } from '@nestjs/common';
import { PaymentsService } from '../../modules/payments/payments.service';
import Stripe from 'stripe';

@Controller('webhooks')
export class WebhookController {
  private stripe: Stripe;

  constructor(private paymentsService: PaymentsService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  @Post('stripe')
  async handleStripeWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(
            (event as Stripe.Event).data.object as Stripe.PaymentIntent,
          );
          break;

        case 'charge.refunded':
          await this.handleRefund(event.data.object);
          break;
      }

      return { received: true };
    } catch {
      throw new HttpException('Webhook Error', 400);
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    await this.paymentsService.updatePaymentStatus(
      paymentIntent.metadata.paymentId,
      'completed',
    );

    await this.paymentsService.updateUserBalance(
      parseInt(paymentIntent.metadata.userId),
      parseFloat(paymentIntent.metadata.amount),
    );
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
    await this.paymentsService.updatePaymentStatus(
      paymentIntent.metadata.paymentId,
      'failed',
    );
  }

  private async handleRefund(charge: Stripe.Charge) {
    await this.paymentsService.processRefund(
      charge.payment_intent as string,
      charge.amount_refunded / 100,
    );
  }
}
