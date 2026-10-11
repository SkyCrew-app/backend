import { Injectable } from '@nestjs/common';
import { stripeClient } from './stripe.client';

@Injectable()
export class StripeService {
  async createPaymentIntent(amount: number, currency: string = 'eur') {
    return stripeClient().paymentIntents.create({
      // Stripe counts in cents.
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  async confirmPayment(paymentIntentId: string) {
    return stripeClient().paymentIntents.retrieve(paymentIntentId);
  }
}
