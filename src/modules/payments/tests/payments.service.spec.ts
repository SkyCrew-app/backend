import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { translationOf } from '../../../common/i18n/localized-exception';
import { FakeDatabase, tables } from '../../../../test/support/fake-database';
import {
  MOVE_BALANCE_NOT_BELOW_ZERO_SQL,
  MOVE_BALANCE_SQL,
  isPositiveMoney,
  toCents,
} from '../money';
import { PaymentsService } from '../payments.service';

const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  return translationOf(error)?.key ?? error?.message ?? null;
};

describe('PaymentsService', () => {
  let database: FakeDatabase;
  let service: PaymentsService;
  let stripe: { createPaymentIntent: jest.Mock; confirmPayment: jest.Mock };
  let paypal: { createOrder: jest.Mock; isOrderPaid: jest.Mock };
  let notifications: { create: jest.Mock };
  let member: { id: number };

  const admin = { id: 99, email: 'admin@test.com', role: 'Administrateur' };
  const balance = () => database.balanceOf(member.id);
  const lines = () =>
    database
      .rows(tables.Payment)
      .map(
        (line) =>
          `${line.kind}:${Number(line.amount).toFixed(2)}:${line.payment_status}`,
      );

  beforeEach(() => {
    database = new FakeDatabase();
    member = database.insert(tables.User, {
      first_name: 'John',
      email: 'john@test.com',
      language: 'fr',
      user_account_balance: 100,
    });
    stripe = {
      createPaymentIntent: jest
        .fn()
        .mockResolvedValue({ id: 'pi_1', client_secret: 'secret' }),
      confirmPayment: jest
        .fn()
        .mockResolvedValue({ status: 'succeeded', amount_received: 5000 }),
    };
    paypal = {
      createOrder: jest.fn().mockResolvedValue({ result: { id: 'order_1' } }),
      isOrderPaid: jest.fn().mockResolvedValue(true),
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    service = new PaymentsService(
      database.repository(tables.Payment),
      stripe as any,
      paypal as any,
      database.repository(tables.User),
      database.repository(tables.Invoice),
      notifications as any,
    );
  });

  const topUp = (overrides: object = {}) =>
    database.insert(tables.Payment, {
      user: { id: member.id },
      amount: 50,
      payment_method: 'stripe',
      payment_status: 'pending',
      kind: 'top_up',
      refunded_amount: 0,
      external_payment_id: 'pi_1',
      ...overrides,
    });

  describe('money', () => {
    it('accepts only positive amounts with at most two decimals', () => {
      for (const amount of [0.01, 1, 49.99, 5000]) {
        expect(isPositiveMoney(amount)).toBe(true);
      }
      for (const amount of [0, -1, 1.005, NaN, Infinity, '10', null]) {
        expect(isPositiveMoney(amount)).toBe(false);
      }
      expect(toCents(199.995)).toBe(20000);
    });

    it('moves a balance in one statement, with the floor inside it', () => {
      expect(MOVE_BALANCE_SQL).toContain(
        '"user_account_balance" = "user_account_balance" + $1::numeric',
      );
      expect(MOVE_BALANCE_NOT_BELOW_ZERO_SQL).toContain(
        'AND "user_account_balance" + $1::numeric >= 0',
      );
    });
  });

  describe('updateUserBalance', () => {
    it('adds to the balance without reading it first', async () => {
      const findOne = jest.spyOn(database.manager, 'findOne');

      expect(await service.updateUserBalance(member.id, 25.5)).toBe(125.5);
      expect(await service.updateUserBalance(member.id, -25.5)).toBe(100);

      expect(findOne).not.toHaveBeenCalled();
      expect(database.statements).toEqual([MOVE_BALANCE_SQL, MOVE_BALANCE_SQL]);
    });

    it('loses no update when several arrive together', async () => {
      await Promise.all(
        Array.from({ length: 10 }, () =>
          service.updateUserBalance(member.id, 10),
        ),
      );
      expect(balance()).toBe(200);
    });

    it('refuses an unknown member and an amount that is not a number', async () => {
      await expect(service.updateUserBalance(999, 10)).rejects.toThrow(
        'User not found',
      );
      await expect(
        service.updateUserBalance(member.id, 'abc' as any),
      ).rejects.toThrow('Invalid amount');
    });
  });

  describe('chargeBooking', () => {
    it('lets one of two simultaneous charges through when the balance covers one', async () => {
      const results = await Promise.allSettled([
        service.chargeBooking(database.manager, {
          userId: member.id,
          cents: 10000,
        }),
        service.chargeBooking(database.manager, {
          userId: member.id,
          cents: 10000,
        }),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      expect(balance()).toBe(0);
      expect(lines()).toEqual(['booking:100.00:completed']);
    });
  });

  describe('createWithdrawal', () => {
    it('takes the amount, records the line and the invoice of the member', async () => {
      const payment = await service.createWithdrawal({
        user_id: member.id,
        amount: 40,
        payment_method: 'account_balance',
      });

      expect(balance()).toBe(60);
      expect(payment).toMatchObject({ kind: 'booking', amount: 40 });
      expect(database.rows(tables.Invoice)[0]).toMatchObject({
        amount: 40,
        user: { id: member.id },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ notification_type: 'WITHDRAWAL' }),
      );
    });

    it.each([-3600, 0, 10.005, NaN])(
      'refuses the amount %p: a withdrawal never credits',
      async (amount) => {
        const error = await service
          .createWithdrawal({
            user_id: member.id,
            amount,
            payment_method: 'account_balance',
          })
          .catch((caught) => caught);

        expect(error).toBeInstanceOf(BadRequestException);
        expect(translationOf(error).key).toBe('error.payment.invalidAmount');
        expect(balance()).toBe(100);
        expect(database.rows(tables.Payment)).toHaveLength(0);
      },
    );

    it('refuses more than the balance', async () => {
      expect(
        await refusal(
          service.createWithdrawal({
            user_id: member.id,
            amount: 100.01,
            payment_method: 'account_balance',
          }),
        ),
      ).toBe('error.reservation.insufficientBalance');
      expect(balance()).toBe(100);
    });

    it('takes nothing when the line cannot be recorded', async () => {
      database.failNextSaveOf = tables.Payment;

      await expect(
        service.createWithdrawal({
          user_id: member.id,
          amount: 40,
          payment_method: 'account_balance',
        }),
      ).rejects.toThrow('write failed');
      expect(balance()).toBe(100);
      expect(database.rows(tables.Invoice)).toHaveLength(0);
    });

    it('throws when the member is unknown', async () => {
      await expect(
        service.createWithdrawal({
          user_id: 999,
          amount: 50,
          payment_method: 'account_balance',
        }),
      ).rejects.toThrow('User with ID 999 not found');
    });
  });

  describe('create', () => {
    it('records an expected payment for its member, without crediting', async () => {
      const payment = await service.create({
        user_id: member.id,
        amount: 100,
        payment_method: 'cheque',
      });

      expect(payment).toMatchObject({
        payment_status: 'pending',
        amount: 100,
        payment_method: 'cheque',
      });
      expect(database.rows(tables.Payment)[0].user).toEqual({ id: member.id });
      expect(balance()).toBe(100);
    });

    it('refuses a negative amount', async () => {
      expect(
        await refusal(
          service.create({
            user_id: member.id,
            amount: -5,
            payment_method: 'cheque',
          }),
        ),
      ).toBe('error.payment.invalidAmount');
    });
  });

  describe('reading', () => {
    it('finds payments by id, member and invoice', async () => {
      const invoice = database.insert(tables.Invoice, { amount: 50 });
      const payment = topUp({ invoice: { id: invoice.id } });

      expect((await service.findAll()).map((found) => found.id)).toEqual([
        payment.id,
      ]);
      expect((await service.findOne(payment.id)).user.id).toBe(member.id);
      expect(await service.findByUser(member.id)).toHaveLength(1);
      expect(await service.findByUser(12345)).toHaveLength(0);
      expect(await service.findByInvoice(invoice.id)).toHaveLength(1);
    });
  });

  describe('processPayment', () => {
    it('opens a card payment at the provider and keeps it pending', async () => {
      const payment = await service.processPayment({
        user_id: member.id,
        amount: 100,
        payment_method: 'stripe',
      });

      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(100);
      expect(payment).toMatchObject({
        kind: 'top_up',
        payment_status: 'pending',
        external_payment_id: 'pi_1',
        payment_details: JSON.stringify({
          id: 'pi_1',
          client_secret: 'secret',
        }),
      });
      expect(balance()).toBe(100);
    });

    it('opens a PayPal order', async () => {
      const payment = await service.processPayment({
        user_id: member.id,
        amount: 100,
        payment_method: 'paypal',
      });

      expect(paypal.createOrder).toHaveBeenCalledWith(100);
      expect(payment.external_payment_id).toBe('order_1');
    });

    it.each([0.5, 5000.01, -20])(
      'refuses %p euros, outside the bounds of a top-up',
      async (amount) => {
        expect(
          await refusal(
            service.processPayment({
              user_id: member.id,
              amount,
              payment_method: 'stripe',
            }),
          ),
        ).toBe('error.payment.amountOutOfRange');
        expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
      },
    );

    it('refuses a third decimal before anything is charged', async () => {
      expect(
        await refusal(
          service.processPayment({
            user_id: member.id,
            amount: 1.005,
            payment_method: 'stripe',
          }),
        ),
      ).toBe('error.payment.invalidAmount');
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('refuses an unknown method and an unknown member', async () => {
      await expect(
        service.processPayment({
          user_id: member.id,
          amount: 100,
          payment_method: 'unsupported',
        }),
      ).rejects.toThrow('Payment method not supported');
      await expect(
        service.processPayment({
          user_id: 999,
          amount: 100,
          payment_method: 'stripe',
        }),
      ).rejects.toThrow('User with ID 999 not found');
    });
  });

  describe('settlePayment', () => {
    it('credits the account once the card payment is confirmed', async () => {
      topUp();

      const settled = await service.settlePayment('pi_1');

      expect(stripe.confirmPayment).toHaveBeenCalledWith('pi_1');
      expect(settled.payment_status).toBe('completed');
      expect(balance()).toBe(150);
      expect(settled.invoice).toMatchObject({ amount: 50 });
      expect(database.rows(tables.Invoice)[0].user).toEqual({ id: member.id });
      expect(
        notifications.create.mock.calls.map(
          ([notification]) => notification.notification_type,
        ),
      ).toEqual(['INVOICE_CREATED', 'PAYMENT_RECEIVED']);
    });

    it('does not credit when the provider received less', async () => {
      topUp();
      stripe.confirmPayment.mockResolvedValue({
        status: 'succeeded',
        amount_received: 100,
      });

      expect(await refusal(service.settlePayment('pi_1'))).toBe(
        'error.payment.notConfirmedByProvider',
      );
      expect(balance()).toBe(100);
    });

    it('credits a PayPal order once it is paid', async () => {
      topUp({ payment_method: 'paypal', external_payment_id: 'order_1' });

      await service.settlePayment('order_1');
      expect(paypal.isOrderPaid).toHaveBeenCalledWith('order_1');
      expect(balance()).toBe(150);

      paypal.isOrderPaid.mockResolvedValue(false);
      topUp({ payment_method: 'paypal', external_payment_id: 'order_2' });
      expect(await refusal(service.settlePayment('order_2'))).toBe(
        'error.payment.notConfirmedByProvider',
      );
      expect(balance()).toBe(150);
    });

    it('credits once when the member and the webhook confirm together', async () => {
      topUp();

      await Promise.all([
        service.settlePayment('pi_1'),
        service.settlePayment('pi_1'),
        service.settlePayment('pi_1'),
      ]);

      expect(balance()).toBe(150);
      expect(database.rows(tables.Invoice)).toHaveLength(1);
    });

    it('does not credit twice a payment already completed', async () => {
      topUp({ payment_status: 'completed' });

      await service.settlePayment('pi_1');

      expect(stripe.confirmPayment).not.toHaveBeenCalled();
      expect(balance()).toBe(100);
    });

    it('leaves the payment to be confirmed again when crediting fails half-way', async () => {
      topUp();
      database.failNextSaveOf = tables.Invoice;

      await expect(service.settlePayment('pi_1')).rejects.toThrow(
        'write failed',
      );
      // Neither completed without credit, nor credited without a trace.
      expect(database.rows(tables.Payment)[0].payment_status).toBe('pending');
      expect(balance()).toBe(100);

      await service.settlePayment('pi_1');
      expect(balance()).toBe(150);
    });

    it('refuses a member confirming the payment of someone else', async () => {
      topUp();
      const error = await service
        .settlePayment('pi_1', { id: 7, email: 'x@test.com', role: 'Pilote' })
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(balance()).toBe(100);
    });

    it('refuses a refunded payment', async () => {
      topUp({ payment_status: 'refunded' });
      expect(await refusal(service.settlePayment('pi_1'))).toBe(
        'error.payment.notConfirmable',
      );
    });

    it('throws when the payment is unknown', async () => {
      await expect(service.settlePayment('pi_unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markPaymentFailed', () => {
    it('only touches a payment still waiting', async () => {
      topUp();
      topUp({ external_payment_id: 'pi_2', payment_status: 'completed' });

      await service.markPaymentFailed('pi_1');
      await service.markPaymentFailed('pi_2');

      expect(
        database.rows(tables.Payment).map((line) => line.payment_status),
      ).toEqual(['failed', 'completed']);
    });
  });

  describe('updatePaymentStatus', () => {
    it('settles through the provider when asked to complete', async () => {
      topUp();
      const settled = await service.updatePaymentStatus('pi_1', 'completed');
      expect(settled.payment_status).toBe('completed');
      expect(balance()).toBe(150);
    });

    it('records another status without touching the balance', async () => {
      topUp();
      const updated = await service.updatePaymentStatus('pi_1', 'failed');
      expect(updated.payment_status).toBe('failed');
      expect(balance()).toBe(100);
    });

    it('never reopens a payment that credited the account', async () => {
      topUp();
      await service.settlePayment('pi_1');

      // Back to pending, it could be confirmed, and credited, again.
      expect(
        await refusal(service.updatePaymentStatus('pi_1', 'pending')),
      ).toBe('error.payment.statusLocked');
      await service.settlePayment('pi_1');
      expect(balance()).toBe(150);
    });

    it('refuses a status it does not know', async () => {
      topUp();
      expect(
        await refusal(service.updatePaymentStatus('pi_1', 'refunded')),
      ).toBe('error.payment.statusLocked');
    });

    it('throws when the payment is unknown', async () => {
      await expect(
        service.updatePaymentStatus('pi_unknown', 'failed'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('refunds made by the provider', () => {
    beforeEach(async () => {
      topUp({ amount: 100 });
      stripe.confirmPayment.mockResolvedValue({
        status: 'succeeded',
        amount_received: 10000,
      });
      await service.settlePayment('pi_1');
      notifications.create.mockClear();
    });

    it('follows partial refunds announced as a running total', async () => {
      expect(balance()).toBe(200);

      await service.applyProviderRefund('pi_1', 20);
      expect(balance()).toBe(180);

      // 50 in total: 30 more, not 50 more and not nothing.
      await service.applyProviderRefund('pi_1', 50);
      expect(balance()).toBe(150);
      expect(lines()).toEqual([
        'top_up:100.00:completed',
        'provider_refund:20.00:completed',
        'provider_refund:30.00:completed',
      ]);
      expect(database.rows(tables.Payment)[0].refunded_amount).toBe(50);
    });

    it('ignores the same announcement received again', async () => {
      await service.applyProviderRefund('pi_1', 50);
      await service.applyProviderRefund('pi_1', 50);
      await Promise.all([
        service.applyProviderRefund('pi_1', 50),
        service.applyProviderRefund('pi_1', 50),
      ]);

      expect(balance()).toBe(150);
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(database.locks).toContain('payments:1');
    });

    it('marks the top-up refunded when all of it was given back, even below zero', async () => {
      database.rows(tables.User)[0].user_account_balance = 30;

      const payment = await service.applyProviderRefund('pi_1', 100);

      expect(payment.payment_status).toBe('refunded');
      // The member had already spent it: the balance shows the debt.
      expect(balance()).toBe(-70);
    });

    it('never takes back more than the top-up', async () => {
      await service.applyProviderRefund('pi_1', 500);
      expect(balance()).toBe(100);
    });

    it('refuses a payment that never credited the account', async () => {
      topUp({ external_payment_id: 'pi_2', payment_status: 'pending' });
      expect(await refusal(service.applyProviderRefund('pi_2', 10))).toBe(
        'error.payment.notRefundable',
      );
      await expect(
        service.applyProviderRefund('pi_unknown', 10),
      ).rejects.toThrow(NotFoundException);
      expect(balance()).toBe(200);
    });

    it('takes a chargeback from the balance, once per dispute', async () => {
      await service.applyDispute('pi_1', 'dp_1', 100);
      await service.applyDispute('pi_1', 'dp_1', 100);

      expect(balance()).toBe(100);
      expect(lines()).toEqual([
        'top_up:100.00:completed',
        'provider_refund:100.00:completed',
      ]);
      await expect(
        service.applyDispute('pi_unknown', 'dp_2', 100),
      ).rejects.toThrow(NotFoundException);
    });

    describe('recorded by an administrator', () => {
      it('adds the amount given back to what was already recorded', async () => {
        await service.processRefund('pi_1', 20);
        await service.processRefund('pi_1', 30);

        expect(balance()).toBe(150);
        expect(database.rows(tables.Payment)[0].refunded_amount).toBe(50);
      });

      it.each([-50, 0, 10.001])(
        'refuses the amount %p: a refund never credits',
        async (amount) => {
          expect(await refusal(service.processRefund('pi_1', amount))).toBe(
            'error.payment.invalidAmount',
          );
          expect(balance()).toBe(200);
        },
      );

      it('refuses more than what is left of the payment', async () => {
        await service.processRefund('pi_1', 80);
        expect(await refusal(service.processRefund('pi_1', 30))).toBe(
          'error.payment.refundExceedsPayment',
        );
        expect(balance()).toBe(120);
      });

      it('throws when the payment is unknown', async () => {
        await expect(service.processRefund('pi_unknown', 10)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  describe('adjustBalance', () => {
    const adjustment = (overrides: object = {}) => ({
      user_id: member.id,
      amount: 250,
      credit: true,
      payment_method: 'cheque',
      reason: 'Chèque n° 1234',
      ...overrides,
    });

    it('credits the member and records who, how and why', async () => {
      const payment = await service.adjustBalance(adjustment(), admin);

      expect(balance()).toBe(350);
      expect(payment).toMatchObject({
        kind: 'manual_credit',
        amount: 250,
        payment_method: 'cheque',
        payment_status: 'completed',
        reason: 'Chèque n° 1234',
        user: { id: member.id },
      });
      expect(database.rows(tables.Payment)[0].created_by_id).toBe(99);
      // The line is in the member's history.
      expect(await service.findByUser(member.id)).toHaveLength(1);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: member.id,
          notification_type: 'PAYMENT_RECEIVED',
        }),
      );
    });

    it('debits the member, never below zero', async () => {
      await service.adjustBalance(
        adjustment({ credit: false, amount: 60, payment_method: 'correction' }),
        admin,
      );
      expect(balance()).toBe(40);
      expect(lines()).toEqual(['manual_debit:60.00:completed']);

      expect(
        await refusal(
          service.adjustBalance(
            adjustment({ credit: false, amount: 60 }),
            admin,
          ),
        ),
      ).toBe('error.payment.debitExceedsBalance');
      expect(balance()).toBe(40);
    });

    it.each([
      ['a negative amount', { amount: -250 }, 'error.payment.invalidAmount'],
      ['a zero amount', { amount: 0 }, 'error.payment.invalidAmount'],
      ['a third decimal', { amount: 10.001 }, 'error.payment.invalidAmount'],
      [
        'an enormous amount',
        { amount: 10000.01 },
        'error.payment.adjustmentTooLarge',
      ],
      ['no reason', { reason: '   ' }, 'error.payment.reasonRequired'],
      [
        'an unknown method',
        { payment_method: 'stripe' },
        'error.payment.unknownManualMethod',
      ],
    ])('refuses %s', async (_case, overrides, key) => {
      expect(
        await refusal(service.adjustBalance(adjustment(overrides), admin)),
      ).toBe(key);
      expect(balance()).toBe(100);
      expect(database.rows(tables.Payment)).toHaveLength(0);
    });

    it('refuses an unknown member', async () => {
      await expect(
        service.adjustBalance(adjustment({ user_id: 999 }), admin),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
