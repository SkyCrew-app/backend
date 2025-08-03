import { Payment } from '../entity/payments.entity';
import { User } from '../../users/entity/users.entity';
import { Invoice } from '../../invoices/entity/invoices.entity';

describe('Payment Entity', () => {
  it('should create a payment instance', () => {
    const payment = new Payment();
    expect(payment).toBeInstanceOf(Payment);
  });

  it('should set all properties correctly', () => {
    const payment = new Payment();
    const user = new User();
    const invoice = new Invoice();

    user.id = 1;
    invoice.id = 1;

    payment.id = 1;
    payment.user = user;
    payment.invoice = invoice;
    payment.amount = 100.5;
    payment.payment_date = new Date('2023-01-01');
    payment.payment_method = 'stripe';
    payment.payment_status = 'completed';
    payment.external_payment_id = 'pi_test123';
    payment.payment_details = '{"client_secret": "secret"}';
    payment.error_message = null;

    expect(payment.id).toBe(1);
    expect(payment.user).toBe(user);
    expect(payment.invoice).toBe(invoice);
    expect(payment.amount).toBe(100.5);
    expect(payment.payment_date).toEqual(new Date('2023-01-01'));
    expect(payment.payment_method).toBe('stripe');
    expect(payment.payment_status).toBe('completed');
    expect(payment.external_payment_id).toBe('pi_test123');
    expect(payment.payment_details).toBe('{"client_secret": "secret"}');
    expect(payment.error_message).toBeNull();
  });

  it('should allow optional invoice', () => {
    const payment = new Payment();
    expect(payment.invoice).toBeUndefined();
  });

  it('should allow nullable fields', () => {
    const payment = new Payment();

    payment.external_payment_id = null;
    payment.payment_details = null;
    payment.error_message = null;

    expect(payment.external_payment_id).toBeNull();
    expect(payment.payment_details).toBeNull();
    expect(payment.error_message).toBeNull();
  });
});
