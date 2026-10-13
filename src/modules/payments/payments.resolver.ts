import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { PaymentsService } from './payments.service';
import { Payment } from './entity/payments.entity';
import { CreatePaymentInput } from './dto/create-payment.input';
import { AdjustBalanceInput } from './dto/adjust-balance.input';
import { PaymentResult } from './dto/payment-result.input';
import { UseFilters, UseGuards } from '@nestjs/common';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  assertSelfOrRole,
  isAdmin,
  SessionUser,
} from '../../common/auth/access';

import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';

@Resolver(() => Payment)
@UseFilters(LocalizedExceptionFilter)
export class PaymentsResolver {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly adminActions: AdminActionsService,
  ) {}

  // Credits or debits a member's account by hand (cash, cheque, correction),
  // with a reason: administrators only. The administrator is taken from the
  // session.
  @Mutation(() => Payment)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async adjustMemberBalance(
    @Args('input') input: AdjustBalanceInput,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const payment = await this.paymentsService.adjustBalance(
      input,
      currentUser,
    );
    await this.adminActions.record(
      currentUser,
      ADMIN_ACTION.BALANCE_ADJUSTED,
      {
        type: 'member',
        id: input.user_id,
        label:
          [payment?.user?.first_name, payment?.user?.last_name]
            .filter(Boolean)
            .join(' ') || null,
      },
      {
        paymentId: payment?.id ?? null,
        direction: input.credit ? 'credit' : 'debit',
        amount: input.amount,
        method: input.payment_method,
        reason: input.reason,
      },
    );
    return payment;
  }

  // Records a payment that is expected: administrators only. It credits
  // nothing (see adjustMemberBalance).
  @Mutation(() => Payment)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  createPayment(
    @Args('createPaymentInput') createPaymentInput: CreatePaymentInput,
  ) {
    return this.paymentsService.create(createPaymentInput);
  }

  @Query(() => [Payment], { name: 'payments' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.paymentsService.findAll();
  }

  @Query(() => Payment, { name: 'payment' })
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const payment = await this.paymentsService.findOne(id);
    if (payment) {
      assertSelfOrRole(currentUser, payment.user?.id);
    }
    return payment;
  }

  @Query(() => [Payment], { name: 'paymentsByUser' })
  @UseGuards(JwtAuthGuard)
  paymentsByUser(
    @Args('userId', { type: () => Int }) userId: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    assertSelfOrRole(currentUser, userId);
    return this.paymentsService.findByUser(userId);
  }

  @Query(() => [Payment])
  @UseGuards(JwtAuthGuard)
  async paymentsByInvoice(
    @Args('invoiceId', { type: () => Int }) invoiceId: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const payments = await this.paymentsService.findByInvoice(invoiceId);
    if (isAdmin(currentUser)) {
      return payments;
    }
    // A member only sees their own payments on an invoice.
    return payments.filter(
      (payment) => Number(payment.user?.id) === Number(currentUser?.id),
    );
  }

  @Mutation(() => PaymentResult)
  @UseGuards(JwtAuthGuard)
  async processPayment(
    @Args('createPaymentInput') createPaymentInput: CreatePaymentInput,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<PaymentResult> {
    // A member tops up their own account. Only an administrator may start
    // a payment on behalf of someone else.
    const payment = await this.paymentsService.processPayment({
      ...createPaymentInput,
      user_id: isAdmin(currentUser)
        ? createPaymentInput.user_id
        : currentUser.id,
    });

    if (!payment.user) {
      throw new Error('User not found for payment');
    }

    const paymentDetails = payment.payment_details
      ? JSON.parse(payment.payment_details)
      : {};

    return {
      id: payment.id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_status: payment.payment_status,
      external_payment_id: payment.external_payment_id,
      client_secret: paymentDetails.client_secret || null,
      user: payment.user,
    };
  }

  // Called when the member comes back from the payment form. The account is
  // credited only if the provider confirms the payment, and only once.
  @Mutation(() => Payment)
  @UseGuards(JwtAuthGuard)
  async confirmPayment(
    @Args('paymentId', { type: () => String }) paymentId: string,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Payment> {
    return this.paymentsService.settlePayment(paymentId, currentUser);
  }

  @Mutation(() => Payment)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updatePaymentStatus(
    @Args('paymentId', { type: () => String }) paymentId: string,
    @Args('status', { type: () => String }) status: string,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Payment> {
    const payment = await this.paymentsService.updatePaymentStatus(
      paymentId,
      status,
    );
    await this.adminActions.record(
      currentUser,
      ADMIN_ACTION.PAYMENT_STATUS_CHANGED,
      { type: 'payment', id: payment?.id ?? paymentId },
      {
        requested: status,
        status: payment?.payment_status ?? null,
        memberId: payment?.user?.id ?? null,
        amount: payment?.amount ?? null,
      },
    );
    return payment;
  }

  @Mutation(() => Payment)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async processRefund(
    @Args('paymentIntentId', { type: () => String }) paymentIntentId: string,
    @Args('amount', { type: () => Number }) amount: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Payment> {
    const payment = await this.paymentsService.processRefund(
      paymentIntentId,
      amount,
    );
    await this.adminActions.record(
      currentUser,
      ADMIN_ACTION.PAYMENT_REFUND_RECORDED,
      { type: 'payment', id: payment?.id ?? paymentIntentId },
      {
        amount,
        refundedInTotal: payment?.refunded_amount ?? null,
        memberId: payment?.user?.id ?? null,
      },
    );
    return payment;
  }
}
