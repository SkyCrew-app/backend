import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaymentsModule } from '../payments.module';
import { PaymentsService } from '../payments.service';
import { PaymentsResolver } from '../payments.resolver';
import { StripeService } from '../libs/stripe.service';
import { PaypalService } from '../libs/paypal.service';
import { Payment } from '../entity/payments.entity';
import { User } from '../../users/entity/users.entity';
import { Invoice } from '../../invoices/entity/invoices.entity';
import { Notification } from '../../notifications/entity/notifications.entity';
import { WebhookController } from '../../../common/controllers/webhook.controller';
import { NotificationsService } from '../../notifications/notifications.service';

// Mock les services externes pour éviter l'initialisation des APIs
jest.mock('../libs/stripe.service');
jest.mock('../libs/paypal.service');

describe('PaymentsModule', () => {
  let module: TestingModule;

  beforeAll(() => {
    // Définir les variables d'environnement nécessaires pour les tests
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
    process.env.PAYPAL_CLIENT_ID = 'fake_paypal_client_id';
    process.env.PAYPAL_CLIENT_SECRET = 'fake_paypal_client_secret';
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      // Mock des repositories du PaymentsModule
      .overrideProvider(getRepositoryToken(Payment))
      .useValue({})
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .overrideProvider(getRepositoryToken(Invoice))
      .useValue({})
      // Mock du repository du NotificationsModule (importé par PaymentsModule)
      .overrideProvider(getRepositoryToken(Notification))
      .useValue({})
      // Mock du DataSource
      .overrideProvider(getDataSourceToken())
      .useValue({})
      .overrideProvider(DataSource)
      .useValue({})
      // Mock des services externes
      .overrideProvider(StripeService)
      .useValue({
        createPaymentIntent: jest.fn(),
        confirmPayment: jest.fn(),
      })
      .overrideProvider(PaypalService)
      .useValue({
        createOrder: jest.fn(),
        capturePayment: jest.fn(),
      })
      .overrideProvider(NotificationsService)
      .useValue({
        create: jest.fn(),
      })
      .compile();
  });

  afterAll(() => {
    // Nettoyer les variables d'environnement après les tests
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide PaymentsService', () => {
    const service = module.get<PaymentsService>(PaymentsService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(PaymentsService);
  });

  it('should provide PaymentsResolver', () => {
    const resolver = module.get<PaymentsResolver>(PaymentsResolver);
    expect(resolver).toBeDefined();
    expect(resolver).toBeInstanceOf(PaymentsResolver);
  });

  it('should provide StripeService', () => {
    const stripeService = module.get<StripeService>(StripeService);
    expect(stripeService).toBeDefined();
  });

  it('should provide PaypalService', () => {
    const paypalService = module.get<PaypalService>(PaypalService);
    expect(paypalService).toBeDefined();
  });

  it('should provide WebhookController', () => {
    const controller = module.get<WebhookController>(WebhookController);
    expect(controller).toBeDefined();
  });

  it('should export PaymentsService', () => {
    const exportedService = module.get<PaymentsService>(PaymentsService);
    expect(exportedService).toBeDefined();
  });

  it('should export StripeService', () => {
    const exportedStripeService = module.get<StripeService>(StripeService);
    expect(exportedStripeService).toBeDefined();
  });

  it('should export PaypalService', () => {
    const exportedPaypalService = module.get<PaypalService>(PaypalService);
    expect(exportedPaypalService).toBeDefined();
  });
});
