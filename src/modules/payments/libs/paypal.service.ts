import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as paypal from '@paypal/checkout-server-sdk';

@Injectable()
export class PaypalService {
  private client: paypal.core.PayPalHttpClient | null = null;

  // PayPal is optional, and built on first use like the card payments. The
  // sandbox is used unless PAYPAL_MODE is set to "live".
  private getClient(): paypal.core.PayPalHttpClient {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        "Le paiement par PayPal n'est pas configuré",
      );
    }

    if (!this.client) {
      const environment =
        process.env.PAYPAL_MODE === 'live'
          ? new paypal.core.LiveEnvironment(clientId, clientSecret)
          : new paypal.core.SandboxEnvironment(clientId, clientSecret);
      this.client = new paypal.core.PayPalHttpClient(environment);
    }
    return this.client;
  }

  async createOrder(amount: number) {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'EUR',
            value: amount.toString(),
          },
        },
      ],
    });
    return this.getClient().execute(request);
  }

  async capturePayment(orderId: string) {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    return this.getClient().execute(request);
  }
}
