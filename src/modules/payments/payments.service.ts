import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Payment } from './entity/payments.entity';
import { CreatePaymentInput } from './dto/create-payment.input';
import { StripeService } from './libs/stripe.service';
import { PaypalService } from './libs/paypal.service';
import { User } from '../users/entity/users.entity';
import { Invoice } from '../invoices/entity/invoices.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { isAdmin, SessionUser } from '../../common/auth/access';

// Bounds of an account top-up, in euros.
export const TOP_UP_MIN = 1;
export const TOP_UP_MAX = 5000;

// A payment can be settled while it waits for the provider, or after a first
// attempt that failed.
const SETTLEABLE_STATUSES = ['pending', 'failed'];

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private stripeService: StripeService,
    private paypalService: PaypalService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private readonly NotificationsService: NotificationsService,
  ) {}

  async create(createPaymentInput: CreatePaymentInput): Promise<Payment> {
    const payment = this.paymentsRepository.create({
      ...createPaymentInput,
      payment_date: new Date(),
      payment_status: 'pending',
    });
    return this.paymentsRepository.save(payment);
  }

  async createWithdrawal(
    createPaymentInput: CreatePaymentInput,
  ): Promise<Payment> {
    const user = await this.userRepository.findOne({
      where: { id: createPaymentInput.user_id },
    });

    if (!user) {
      throw new Error(`User with ID ${createPaymentInput.user_id} not found`);
    }

    const payment = this.paymentsRepository.create({
      ...createPaymentInput,
      user: user,
      payment_date: new Date(),
      payment_status: 'completed',
    });

    await this.updateUserBalance(user.id, -createPaymentInput.amount);

    const invoice = await this.invoiceRepository.save({
      invoice_date: new Date(),
      amount: createPaymentInput.amount,
      payment_status: 'completed',
      payment_method: 'account_balance',
      amount_paid: createPaymentInput.amount,
      balance_due: 0,
      paymentId: payment.id,
      userId: user.id,
    });

    payment.invoice = invoice;

    await this.NotificationsService.create({
      user_id: user.id,
      notification_type: 'WITHDRAWAL',
      notification_date: new Date(),
      message: `Un paiement de ${createPaymentInput.amount} a été effectué sur votre compte`,
      is_read: false,
    });

    return this.paymentsRepository.save(payment);
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentsRepository.find({
      relations: ['user', 'invoice'],
    });
  }

  async findOne(id: number): Promise<Payment> {
    return this.paymentsRepository.findOne({
      where: { id },
      relations: ['user', 'invoice'],
    });
  }

  async findByUser(userId: number): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { user: { id: userId } },
      relations: ['invoice', 'user'],
    });
  }

  async findByInvoice(invoiceId: number): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { invoice: { id: invoiceId } },
      relations: ['user'],
    });
  }

  async processPayment(
    createPaymentInput: CreatePaymentInput,
  ): Promise<Payment> {
    const user = await this.userRepository.findOne({
      where: { id: createPaymentInput.user_id },
    });
    if (!user) {
      throw new Error(`User with ID ${createPaymentInput.user_id} not found`);
    }

    const amount = Number(createPaymentInput.amount);
    if (!(amount >= TOP_UP_MIN && amount <= TOP_UP_MAX)) {
      throw new BadRequestException(
        `Le montant doit être compris entre ${TOP_UP_MIN} et ${TOP_UP_MAX} euros`,
      );
    }

    let paymentDetails: { id: string; client_secret?: string };
    switch (createPaymentInput.payment_method) {
      case 'stripe':
        const paymentIntent = await this.stripeService.createPaymentIntent(
          createPaymentInput.amount,
        );
        paymentDetails = {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
        };
        break;

      case 'paypal':
        const paypalOrder = await this.paypalService.createOrder(
          createPaymentInput.amount,
        );
        paymentDetails = {
          id: paypalOrder.result.id,
        };
        break;

      default:
        throw new Error('Payment method not supported');
    }

    const payment = this.paymentsRepository.create({
      ...createPaymentInput,
      payment_date: new Date(),
      payment_status: 'pending',
      external_payment_id: paymentDetails.id,
      payment_details: JSON.stringify(paymentDetails),
      user: user,
    });

    return this.paymentsRepository.save(payment);
  }

  async updateUserBalance(userId: number, amount: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error(`User not found`);

    const amountNumber = Number(amount);
    if (isNaN(amountNumber)) throw new Error(`Invalid amount`);

    const currentBalanceCents = Math.round(user.user_account_balance * 100);
    const amountToAddCents = Math.round(amountNumber * 100);

    const newBalanceCents = currentBalanceCents + amountToAddCents;

    user.user_account_balance = Math.round(newBalanceCents) / 100;

    return this.userRepository.save(user);
  }

  async createInvoice(payment: Payment) {
    const invoice = {
      invoice_date: new Date(),
      userId: payment.user.id,
      amount: payment.amount,
      payment_status: payment.payment_status,
      payment_method: payment.payment_method,
      amount_paid: payment.amount,
      balance_due: 0,
    };

    await this.NotificationsService.create({
      user_id: payment.user.id,
      notification_type: 'INVOICE_CREATED',
      notification_date: new Date(),
      message: `Une facture de ${payment.amount} a été créée`,
      is_read: false,
    });

    const invoiceResult = await this.invoiceRepository.save(invoice);

    return invoiceResult.id;
  }

  // Credits the account once the provider confirms that the money was
  // received. Called by the member coming back from the payment form and by
  // the provider's webhook: whichever comes first credits, the other one finds
  // the payment already completed.
  async settlePayment(
    externalPaymentId: string,
    requester?: SessionUser,
  ): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { external_payment_id: externalPaymentId },
      relations: ['user'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (
      requester &&
      !isAdmin(requester) &&
      Number(payment.user?.id) !== Number(requester.id)
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez confirmer que vos propres paiements',
      );
    }
    if (payment.payment_status === 'completed') {
      return payment;
    }
    if (!SETTLEABLE_STATUSES.includes(payment.payment_status)) {
      throw new BadRequestException('Ce paiement ne peut plus être confirmé');
    }

    await this.assertPaidAtProvider(payment);

    // Only one caller moves the payment to completed, and only that one
    // credits the account.
    const claimed = await this.paymentsRepository.update(
      { id: payment.id, payment_status: In(SETTLEABLE_STATUSES) },
      { payment_status: 'completed' },
    );
    if (!claimed.affected) {
      return this.findOne(payment.id);
    }
    payment.payment_status = 'completed';

    await this.updateUserBalance(payment.user.id, payment.amount);
    const invoiceId = await this.createInvoice(payment);
    payment.invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });

    await this.NotificationsService.create({
      user_id: payment.user.id,
      notification_type: 'PAYMENT_RECEIVED',
      notification_date: new Date(),
      message: `Un ajout de ${payment.amount} a été effectué sur votre compte`,
      is_read: false,
    });

    return this.paymentsRepository.save(payment);
  }

  // The amount is checked at the provider, never taken from the caller.
  private async assertPaidAtProvider(payment: Payment): Promise<void> {
    const expectedCents = Math.round(Number(payment.amount) * 100);
    let paid = false;

    if (payment.payment_method === 'stripe') {
      const intent = await this.stripeService.confirmPayment(
        payment.external_payment_id,
      );
      paid =
        intent?.status === 'succeeded' &&
        Number(intent.amount_received) >= expectedCents;
    } else if (payment.payment_method === 'paypal') {
      const capture = await this.paypalService.capturePayment(
        payment.external_payment_id,
      );
      paid = capture?.result?.status === 'COMPLETED';
    }

    if (!paid) {
      throw new BadRequestException(
        "Le paiement n'a pas été confirmé par le prestataire",
      );
    }
  }

  // Records that an attempt failed. A payment already completed stays so.
  async markPaymentFailed(externalPaymentId: string): Promise<void> {
    await this.paymentsRepository.update(
      { external_payment_id: externalPaymentId, payment_status: 'pending' },
      { payment_status: 'failed' },
    );
  }

  async updatePaymentStatus(
    paymentId: string,
    status: string,
  ): Promise<Payment> {
    if (status === 'completed') {
      return this.settlePayment(paymentId);
    }

    const payment = await this.paymentsRepository.findOne({
      where: { external_payment_id: paymentId },
      relations: ['user'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment.payment_status = status;
    return this.paymentsRepository.save(payment);
  }

  async processRefund(
    paymentIntentId: string,
    amount: number,
  ): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { external_payment_id: paymentIntentId },
      relations: ['user'],
    });

    if (payment) {
      // The provider may announce the same refund more than once.
      if (payment.payment_status === 'refunded') {
        return payment;
      }
      payment.payment_status = 'refunded';
      await this.paymentsRepository.save(payment);

      await this.updateUserBalance(payment.user.id, -amount);

      await this.NotificationsService.create({
        user_id: payment.user.id,
        notification_type: 'PAYMENT_REFUNDED',
        notification_date: new Date(),
        message: `Un remboursement de ${amount} a été effectué sur votre compte`,
        is_read: false,
      });

      return payment;
    }
    throw new Error('Payment not found');
  }

  async refund(user_id: number, amount: number): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { user: { id: user_id }, amount: amount },
      relations: ['user'],
    });

    if (payment) {
      payment.payment_status = 'refunded';
      await this.paymentsRepository.save(payment);

      await this.updateUserBalance(payment.user.id, -amount);

      await this.NotificationsService.create({
        user_id: payment.user.id,
        notification_type: 'PAYMENT_REFUNDED',
        notification_date: new Date(),
        message: `Un remboursement de ${amount} a été effectué sur votre compte`,
        is_read: false,
      });

      return payment;
    }
    throw new Error('Payment not found');
  }
}
