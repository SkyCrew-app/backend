import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { PaymentsService } from './payments.service';
import { Payment } from './entity/payments.entity';
import { CreatePaymentInput } from './dto/create-payment.input';
import { PaymentResult } from './dto/payment-result.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver(() => Payment)
export class PaymentsResolver {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Mutation(() => Payment)
  @UseGuards(JwtAuthGuard)
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
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.paymentsService.findOne(id);
  }

  @Query(() => [Payment], { name: 'paymentsByUser' })
  @UseGuards(JwtAuthGuard)
  paymentsByUser(@Args('userId', { type: () => Int }) userId: number) {
    return this.paymentsService.findByUser(userId);
  }

  @Query(() => [Payment])
  @UseGuards(JwtAuthGuard)
  paymentsByInvoice(@Args('invoiceId', { type: () => Int }) invoiceId: number) {
    return this.paymentsService.findByInvoice(invoiceId);
  }

  @Mutation(() => PaymentResult)
  async processPayment(
    @Args('createPaymentInput') createPaymentInput: CreatePaymentInput,
  ): Promise<PaymentResult> {
    const payment =
      await this.paymentsService.processPayment(createPaymentInput);

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
  async updatePaymentStatus(
    @Args('paymentId', { type: () => String }) paymentId: string,
    @Args('status', { type: () => String }) status: string,
  ): Promise<Payment> {
    return this.paymentsService.updatePaymentStatus(paymentId, status);
  }

  @Mutation(() => Payment)
  async processRefund(
    @Args('paymentIntentId', { type: () => String }) paymentIntentId: string,
    @Args('amount', { type: () => Number }) amount: number,
  ): Promise<Payment> {
    return this.paymentsService.processRefund(paymentIntentId, amount);
  }
}
