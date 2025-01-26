import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsResolver } from './payments.resolver';
import { Payment } from './entity/payments.entity';
import { StripeService } from './libs/stripe.service';
import { PaypalService } from './libs/paypal.service';
import { WebhookController } from '../../common/controllers/webhook.controller';
import { User } from '../users/entity/users.entity';
import { Invoice } from '../invoices/entity/invoices.entity';

@Module({
  controllers: [WebhookController],
  imports: [TypeOrmModule.forFeature([Payment, User, Invoice])],
  providers: [PaymentsResolver, PaymentsService, StripeService, PaypalService],
  exports: [PaymentsService, StripeService, PaypalService],
})
export class PaymentsModule {}
