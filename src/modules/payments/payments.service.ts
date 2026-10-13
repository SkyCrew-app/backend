import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Payment, PAYMENT_KIND } from './entity/payments.entity';
import { CreatePaymentInput } from './dto/create-payment.input';
import { AdjustBalanceInput } from './dto/adjust-balance.input';
import {
  fromCents,
  isPositiveMoney,
  lockRow,
  moveBalance,
  toCents,
} from './money';
import { StripeService } from './libs/stripe.service';
import { PaypalService } from './libs/paypal.service';
import { User } from '../users/entity/users.entity';
import { Invoice } from '../invoices/entity/invoices.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { isAdmin, SessionUser } from '../../common/auth/access';
import { languageOf } from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';

// Bounds of an account top-up, in euros.
export const TOP_UP_MIN = 1;
export const TOP_UP_MAX = 5000;

// A payment can be settled while it waits for the provider, or after a first
// attempt that failed.
const SETTLEABLE_STATUSES = ['pending', 'failed'];

// Statuses an administrator may set by hand. Completing goes through the
// provider; a payment that moved money is never reopened.
const MANUAL_STATUSES = ['pending', 'failed', 'cancelled'];
const MONEY_MOVED_STATUSES = ['completed', 'refunded'];

// An entry made by hand by an administrator: how the money came or went.
export const MANUAL_METHODS = ['cash', 'cheque', 'transfer', 'correction'];
export const MANUAL_ADJUSTMENT_MAX = 10000;
export const MANUAL_REASON_MIN_LENGTH = 3;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

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

  // Every operation that moves money runs in one transaction: the balance
  // and the lines that explain it change together or not at all.
  private inTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
    manager?: EntityManager,
  ): Promise<T> {
    return manager
      ? work(manager)
      : this.paymentsRepository.manager.transaction(work);
  }

  private assertPositiveMoney(amount: unknown): void {
    if (!isPositiveMoney(amount)) {
      throw localized(BadRequestException, 'error.payment.invalidAmount');
    }
  }

  // Records a payment that is still to come. It credits nothing.
  async create(createPaymentInput: CreatePaymentInput): Promise<Payment> {
    this.assertPositiveMoney(createPaymentInput.amount);
    const user = await this.userRepository.findOne({
      where: { id: createPaymentInput.user_id },
    });
    if (!user) {
      throw new NotFoundException(
        `User with ID ${createPaymentInput.user_id} not found`,
      );
    }
    const payment = this.paymentsRepository.create({
      amount: createPaymentInput.amount,
      payment_method: createPaymentInput.payment_method,
      user,
      payment_date: new Date(),
      payment_status: 'pending',
      kind: PAYMENT_KIND.TOP_UP,
    });
    return this.paymentsRepository.save(payment);
  }

  // Takes the price of a booking from the member's balance, within the
  // caller's transaction. The balance never goes below zero.
  async chargeBooking(
    manager: EntityManager,
    charge: { userId: number; cents: number; reservationId?: number | null },
  ): Promise<Payment> {
    if (!Number.isInteger(charge.cents) || charge.cents <= 0) {
      throw localized(BadRequestException, 'error.payment.invalidAmount');
    }
    const balance = await moveBalance(manager, charge.userId, -charge.cents, {
      notBelowZero: true,
    });
    if (balance === null) {
      throw localized(
        BadRequestException,
        'error.reservation.insufficientBalance',
      );
    }

    const amount = fromCents(charge.cents);
    const invoice = await manager.save(Invoice, {
      user: { id: charge.userId },
      invoice_date: new Date(),
      amount,
      payment_status: 'completed',
      payment_method: 'account_balance',
      amount_paid: amount,
      balance_due: 0,
    });

    return manager.save(Payment, {
      user: { id: charge.userId },
      invoice,
      amount,
      payment_date: new Date(),
      payment_method: 'account_balance',
      payment_status: 'completed',
      kind: PAYMENT_KIND.BOOKING,
      reservation_id: charge.reservationId ?? null,
    });
  }

  // Gives back to a member what a booking had taken, as a line of its own.
  async refundBooking(
    manager: EntityManager,
    refund: { userId: number; cents: number; reservationId?: number | null },
  ): Promise<Payment> {
    if (!Number.isInteger(refund.cents) || refund.cents <= 0) {
      throw localized(BadRequestException, 'error.payment.invalidAmount');
    }
    const balance = await moveBalance(manager, refund.userId, refund.cents, {
      notBelowZero: false,
    });
    if (balance === null) {
      throw new NotFoundException(`User with ID ${refund.userId} not found`);
    }
    return manager.save(Payment, {
      user: { id: refund.userId },
      amount: fromCents(refund.cents),
      payment_date: new Date(),
      payment_method: 'account_balance',
      payment_status: 'completed',
      kind: PAYMENT_KIND.BOOKING_REFUND,
      reservation_id: refund.reservationId ?? null,
    });
  }

  // Sent once the transaction is committed: a notification that fails must
  // not undo, nor announce, a movement of money.
  async notifyMovement(
    user: { id: number; language?: string | null },
    type:
      | 'WITHDRAWAL'
      | 'PAYMENT_REFUNDED'
      | 'PAYMENT_RECEIVED'
      | 'INVOICE_CREATED',
    amount: number,
  ): Promise<void> {
    const texts = {
      WITHDRAWAL: 'notification.withdrawal',
      PAYMENT_REFUNDED: 'notification.paymentRefunded',
      PAYMENT_RECEIVED: 'notification.paymentReceived',
      INVOICE_CREATED: 'notification.invoiceCreated',
    } as const;
    try {
      await this.NotificationsService.create({
        user_id: user.id,
        notification_type: type,
        notification_date: new Date(),
        message: translate(languageOf(user), texts[type], { amount }),
        is_read: false,
      });
    } catch (error) {
      this.logger.warn(`Notification ${type} not sent: ${error.message}`);
    }
  }

  // A debit of the balance on its own (no booking attached).
  async createWithdrawal(
    createPaymentInput: CreatePaymentInput,
  ): Promise<Payment> {
    this.assertPositiveMoney(createPaymentInput.amount);
    const user = await this.userRepository.findOne({
      where: { id: createPaymentInput.user_id },
    });
    if (!user) {
      throw new Error(`User with ID ${createPaymentInput.user_id} not found`);
    }

    const payment = await this.inTransaction((manager) =>
      this.chargeBooking(manager, {
        userId: user.id,
        cents: toCents(createPaymentInput.amount),
      }),
    );
    await this.notifyMovement(user, 'WITHDRAWAL', Number(payment.amount));
    return payment;
  }

  // Credit or debit entered by an administrator (cash, cheque, correction),
  // with its reason. It is a line of the member's history like any other.
  async adjustBalance(
    input: AdjustBalanceInput,
    administrator: SessionUser,
  ): Promise<Payment> {
    this.assertPositiveMoney(input.amount);
    if (input.amount > MANUAL_ADJUSTMENT_MAX) {
      throw localized(BadRequestException, 'error.payment.adjustmentTooLarge', {
        max: MANUAL_ADJUSTMENT_MAX,
      });
    }
    const reason = (input.reason ?? '').trim();
    if (reason.length < MANUAL_REASON_MIN_LENGTH) {
      throw localized(BadRequestException, 'error.payment.reasonRequired');
    }
    if (!MANUAL_METHODS.includes(input.payment_method)) {
      throw localized(BadRequestException, 'error.payment.unknownManualMethod');
    }
    const user = await this.userRepository.findOne({
      where: { id: input.user_id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${input.user_id} not found`);
    }

    const cents = toCents(input.amount);
    const payment = await this.inTransaction(async (manager) => {
      const balance = await moveBalance(
        manager,
        user.id,
        input.credit ? cents : -cents,
        { notBelowZero: true },
      );
      if (balance === null) {
        throw localized(
          BadRequestException,
          'error.payment.debitExceedsBalance',
        );
      }
      return manager.save(Payment, {
        user: { id: user.id },
        amount: fromCents(cents),
        payment_date: new Date(),
        payment_method: input.payment_method,
        payment_status: 'completed',
        kind: input.credit
          ? PAYMENT_KIND.MANUAL_CREDIT
          : PAYMENT_KIND.MANUAL_DEBIT,
        reason,
        created_by_id: Number(administrator.id),
      });
    });

    // The trace of who did what, next to the line itself (created_by_id).
    this.logger.log(
      `Balance adjusted by administrator ${administrator.id}: member ${user.id}, ${input.credit ? '+' : '-'}${fromCents(cents).toFixed(2)} EUR (${input.payment_method}), payment ${payment.id}`,
    );
    await this.notifyMovement(
      user,
      input.credit ? 'PAYMENT_RECEIVED' : 'WITHDRAWAL',
      fromCents(cents),
    );
    return this.findOne(payment.id);
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
      throw localized(BadRequestException, 'error.payment.amountOutOfRange', {
        min: TOP_UP_MIN,
        max: TOP_UP_MAX,
      });
    }
    // The provider counts in cents: a third decimal would be charged as one
    // amount and expected as another.
    this.assertPositiveMoney(createPaymentInput.amount);

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
      amount: createPaymentInput.amount,
      payment_method: createPaymentInput.payment_method,
      kind: PAYMENT_KIND.TOP_UP,
      payment_date: new Date(),
      payment_status: 'pending',
      external_payment_id: paymentDetails.id,
      payment_details: JSON.stringify(paymentDetails),
      user: user,
    });

    return this.paymentsRepository.save(payment);
  }

  // Adds an amount (negative to take) to a member's balance, in one SQL
  // statement. Returns the new balance.
  async updateUserBalance(
    userId: number,
    amount: number,
    manager?: EntityManager,
  ): Promise<number> {
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber)) throw new Error(`Invalid amount`);

    const balance = await moveBalance(
      manager ?? this.paymentsRepository.manager,
      userId,
      toCents(amountNumber),
      { notBelowZero: false },
    );
    if (balance === null) throw new Error(`User not found`);
    return fromCents(balance);
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
      throw localized(ForbiddenException, 'error.payment.notOwnPayment');
    }
    if (payment.payment_status === 'completed') {
      return payment;
    }
    if (!SETTLEABLE_STATUSES.includes(payment.payment_status)) {
      throw localized(BadRequestException, 'error.payment.notConfirmable');
    }

    await this.assertPaidAtProvider(payment);

    // Only one caller moves the payment to completed, and only that one
    // credits the account. The claim, the credit and the invoice are one
    // transaction: a payment is never left completed and not credited.
    const credited = await this.inTransaction(async (manager) => {
      const claimed = await manager.update(
        Payment,
        { id: payment.id, payment_status: In(SETTLEABLE_STATUSES) },
        { payment_status: 'completed' },
      );
      if (!claimed.affected) {
        return false;
      }
      const balance = await moveBalance(
        manager,
        payment.user.id,
        toCents(payment.amount),
        { notBelowZero: false },
      );
      if (balance === null) {
        throw new NotFoundException('User not found');
      }
      const invoice = await manager.save(Invoice, {
        user: { id: payment.user.id },
        invoice_date: new Date(),
        amount: payment.amount,
        payment_status: 'completed',
        payment_method: payment.payment_method,
        amount_paid: payment.amount,
        balance_due: 0,
      });
      await manager.save(Payment, { id: payment.id, invoice });
      return true;
    });
    if (!credited) {
      return this.findOne(payment.id);
    }

    await this.notifyMovement(
      payment.user,
      'INVOICE_CREATED',
      Number(payment.amount),
    );
    await this.notifyMovement(
      payment.user,
      'PAYMENT_RECEIVED',
      Number(payment.amount),
    );
    return this.findOne(payment.id);
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
      paid = await this.paypalService.isOrderPaid(payment.external_payment_id);
    }

    if (!paid) {
      throw localized(
        BadRequestException,
        'error.payment.notConfirmedByProvider',
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
    // Reopening a payment that credited the account would let it be
    // confirmed, and credited, a second time.
    if (
      MONEY_MOVED_STATUSES.includes(payment.payment_status) ||
      !MANUAL_STATUSES.includes(status)
    ) {
      throw localized(BadRequestException, 'error.payment.statusLocked');
    }

    payment.payment_status = status;
    return this.paymentsRepository.save(payment);
  }

  // What the provider has given back of a top-up, in total so far (the
  // provider announces a running total, and may announce it more than once).
  // Only the part not yet taken into account leaves the balance, which may go
  // below zero: the money has already left the club.
  async applyProviderRefund(
    externalPaymentId: string,
    totalRefunded: number,
  ): Promise<Payment> {
    const totalCents = toCents(totalRefunded);
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      throw localized(BadRequestException, 'error.payment.invalidAmount');
    }

    let taken = 0;
    const payment = await this.inTransaction(async (manager) => {
      const found = await manager.findOne(Payment, {
        where: { external_payment_id: externalPaymentId },
        relations: ['user'],
      });
      if (!found || !(await lockRow(manager, 'payments', found.id))) {
        throw new NotFoundException('Payment not found');
      }
      // Read again under the lock: another announcement may have just passed.
      const topUp = await manager.findOne(Payment, {
        where: { id: found.id },
        relations: ['user'],
      });
      if (
        topUp.kind !== PAYMENT_KIND.TOP_UP ||
        !MONEY_MOVED_STATUSES.includes(topUp.payment_status)
      ) {
        throw localized(BadRequestException, 'error.payment.notRefundable');
      }

      const amountCents = toCents(topUp.amount);
      const cappedCents = Math.min(totalCents, amountCents);
      const deltaCents = cappedCents - toCents(topUp.refunded_amount ?? 0);
      if (deltaCents <= 0) {
        return topUp;
      }

      await moveBalance(manager, topUp.user.id, -deltaCents, {
        notBelowZero: false,
      });
      topUp.refunded_amount = fromCents(cappedCents);
      if (cappedCents >= amountCents) {
        topUp.payment_status = 'refunded';
      }
      await manager.update(
        Payment,
        { id: topUp.id },
        {
          refunded_amount: topUp.refunded_amount,
          payment_status: topUp.payment_status,
        },
      );
      await manager.save(Payment, {
        user: { id: topUp.user.id },
        amount: fromCents(deltaCents),
        payment_date: new Date(),
        payment_method: topUp.payment_method,
        payment_status: 'completed',
        kind: PAYMENT_KIND.PROVIDER_REFUND,
        reason: externalPaymentId,
      });
      taken = deltaCents;
      return topUp;
    });

    if (taken > 0) {
      await this.notifyMovement(
        payment.user,
        'PAYMENT_REFUNDED',
        fromCents(taken),
      );
    }
    return payment;
  }

  // A chargeback: the bank took the money of a top-up back from the club.
  // Each dispute leaves the balance once, whatever the number of
  // announcements.
  async applyDispute(
    externalPaymentId: string,
    disputeId: string,
    amount: number,
  ): Promise<Payment | null> {
    const cents = toCents(amount);
    if (!disputeId || !Number.isInteger(cents) || cents <= 0) {
      throw localized(BadRequestException, 'error.payment.invalidAmount');
    }

    const disputed: { member?: Payment['user'] } = {};
    const line = await this.inTransaction(async (manager) => {
      const topUp = await manager.findOne(Payment, {
        where: { external_payment_id: externalPaymentId },
        relations: ['user'],
      });
      if (!topUp || !(await lockRow(manager, 'payments', topUp.id))) {
        throw new NotFoundException('Payment not found');
      }
      if (
        topUp.kind !== PAYMENT_KIND.TOP_UP ||
        !MONEY_MOVED_STATUSES.includes(topUp.payment_status)
      ) {
        throw localized(BadRequestException, 'error.payment.notRefundable');
      }
      const already = await manager.findOne(Payment, {
        where: { external_payment_id: disputeId },
      });
      if (already) {
        return null;
      }

      const debitCents = Math.min(cents, toCents(topUp.amount));
      await moveBalance(manager, topUp.user.id, -debitCents, {
        notBelowZero: false,
      });
      disputed.member = topUp.user;
      return manager.save(Payment, {
        user: { id: topUp.user.id },
        amount: fromCents(debitCents),
        payment_date: new Date(),
        payment_method: topUp.payment_method,
        payment_status: 'completed',
        kind: PAYMENT_KIND.PROVIDER_REFUND,
        external_payment_id: disputeId,
        reason: externalPaymentId,
      });
    });

    if (line && disputed.member) {
      await this.notifyMovement(
        disputed.member,
        'WITHDRAWAL',
        Number(line.amount),
      );
    }
    return line;
  }

  // An administrator records that part of a top-up was given back outside
  // the application: `amount` is that part, added to what was already
  // recorded. It does not ask the provider to refund anything.
  async processRefund(
    paymentIntentId: string,
    amount: number,
  ): Promise<Payment> {
    this.assertPositiveMoney(amount);
    const payment = await this.paymentsRepository.findOne({
      where: { external_payment_id: paymentIntentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const refundedCents = toCents(payment.refunded_amount ?? 0);
    if (refundedCents + toCents(amount) > toCents(payment.amount)) {
      throw localized(
        BadRequestException,
        'error.payment.refundExceedsPayment',
      );
    }
    return this.applyProviderRefund(
      paymentIntentId,
      fromCents(refundedCents + toCents(amount)),
    );
  }
}
