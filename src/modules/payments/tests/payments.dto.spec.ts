import { validate } from 'class-validator';
import { CreatePaymentInput } from '../dto/create-payment.input';

describe('CreatePaymentInput', () => {
  let dto: CreatePaymentInput;

  beforeEach(() => {
    dto = new CreatePaymentInput();
  });

  it('should be valid with all required fields', async () => {
    dto.user_id = 1;
    dto.amount = 100.5;
    dto.payment_method = 'stripe';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate amount is a number', async () => {
    dto.user_id = 1;
    dto.amount = 'invalid' as any;
    dto.payment_method = 'stripe';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNumber');
  });

  it('should validate payment_method is a string', async () => {
    dto.user_id = 1;
    dto.amount = 100.5;
    dto.payment_method = 123 as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should accept valid payment methods', async () => {
    const validMethods = ['stripe', 'paypal', 'withdrawal'];

    for (const method of validMethods) {
      dto.user_id = 1;
      dto.amount = 100.0;
      dto.payment_method = method;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });
});

import { UpdatePaymentInput } from '../dto/update-payment.input';

describe('UpdatePaymentInput', () => {
  it('should have required id field', () => {
    const dto = new UpdatePaymentInput();
    dto.id = 1;

    expect(dto.id).toBe(1);
  });

  it('should allow setting inherited properties from CreatePaymentInput', () => {
    const dto = new UpdatePaymentInput();
    dto.id = 1;
    dto.user_id = 2;
    dto.amount = 100.5;
    dto.payment_method = 'stripe';

    expect(dto.id).toBe(1);
    expect(dto.user_id).toBe(2);
    expect(dto.amount).toBe(100.5);
    expect(dto.payment_method).toBe('stripe');
  });

  it('should make all CreatePaymentInput fields optional', () => {
    const dto = new UpdatePaymentInput();
    dto.id = 1;
    // Only id is required, other fields are optional

    expect(dto.user_id).toBeUndefined();
    expect(dto.amount).toBeUndefined();
    expect(dto.payment_method).toBeUndefined();
  });

  it('should be instance of UpdatePaymentInput', () => {
    const dto = new UpdatePaymentInput();
    expect(dto).toBeInstanceOf(UpdatePaymentInput);
  });
});

import { PaymentResult } from '../dto/payment-result.input';
import { User } from '../../users/entity/users.entity';

describe('PaymentResult', () => {
  it('should create PaymentResult instance', () => {
    const paymentResult = new PaymentResult();
    expect(paymentResult).toBeInstanceOf(PaymentResult);
  });

  it('should set all properties correctly', () => {
    const paymentResult = new PaymentResult();
    const user = new User();
    user.id = 1;

    paymentResult.id = 1;
    paymentResult.amount = 100.5;
    paymentResult.payment_method = 'stripe';
    paymentResult.payment_status = 'completed';
    paymentResult.external_payment_id = 'pi_test123';
    paymentResult.client_secret = 'pi_test123_secret';
    paymentResult.user = user;

    expect(paymentResult.id).toBe(1);
    expect(paymentResult.amount).toBe(100.5);
    expect(paymentResult.payment_method).toBe('stripe');
    expect(paymentResult.payment_status).toBe('completed');
    expect(paymentResult.external_payment_id).toBe('pi_test123');
    expect(paymentResult.client_secret).toBe('pi_test123_secret');
    expect(paymentResult.user).toBe(user);
  });

  it('should allow nullable client_secret', () => {
    const paymentResult = new PaymentResult();
    paymentResult.client_secret = null;

    expect(paymentResult.client_secret).toBeNull();
  });
});
