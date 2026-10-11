import { ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

let client: Stripe | null = null;

// Card payments are optional: a club that has not configured them can run
// everything else. The client is only built when a payment is attempted.
export const stripeClient = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new ServiceUnavailableException(
      "Le paiement par carte n'est pas configuré",
    );
  }

  client ??= new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' });
  return client;
};

// For tests: forget the client built with a previous key.
export const resetStripeClient = (): void => {
  client = null;
};
