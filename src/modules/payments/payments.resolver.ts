import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { PaymentsService } from './payments.service';
import { Payment } from './entity/payments.entity';
import { CreatePaymentInput } from './dto/create-payment.input';
import { PaymentResult } from './dto/payment-result.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  assertSelfOrRole,
  isAdmin,
  SessionUser,
} from '../../common/auth/access';

@Resolver(() => Payment)
export class PaymentsResolver {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Records a payment by hand (cheque, cash…): administrators only.
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

  @Mutation(() => Payment)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updatePaymentStatus(
    @Args('paymentId', { type: () => String }) paymentId: string,
    @Args('status', { type: () => String }) status: string,
  ): Promise<Payment> {
    return this.paymentsService.updatePaymentStatus(paymentId, status);
  }

  @Mutation(() => Payment)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async processRefund(
    @Args('paymentIntentId', { type: () => String }) paymentIntentId: string,
    @Args('amount', { type: () => Number }) amount: number,
  ): Promise<Payment> {
    return this.paymentsService.processRefund(paymentIntentId, amount);
  }
}
