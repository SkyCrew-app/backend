import { Random } from './random';
import { DAY, HOUR } from './calendar';
import {
  DraftAdminAction,
  DraftBooking,
  DraftInvoice,
  DraftMember,
  DraftNotification,
  DraftPayment,
  PaymentKind,
} from './model';
import { TOP_UP_REASONS } from './content';
import { balanceSign } from '../../modules/payments/entity/payments.entity';
import { fromCents } from '../../modules/payments/money';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';
import {
  formatInvoiceNumber,
  invoiceYear,
  InvoiceLine,
} from '../../modules/invoices/invoice-number';
import { translate } from '../../common/i18n/translate';
import { formatDate, formatMoney } from '../../common/i18n/languages';

const MINUTE = 60_000;

// Showcase invoices are numbered in their own series: "DEMO-2026-00042".
export const SHOWCASE_INVOICE_PREFIX = 'DEMO';

// Notifications are written for what happened recently only.
export const NOTIFIED_DAYS = 14;

export interface LedgerEvent {
  at: Date;
  member: DraftMember;
  // Negative: taken from the balance.
  cents: number;
  kind: PaymentKind;
  booking: DraftBooking | null;
  reason: string | null;
  method: string;
}

export interface LedgerInput {
  rng: Random;
  now: Date;
  historyStart: Date;
  members: DraftMember[];
  bookings: DraftBooking[];
  // The office member who records entries made by hand.
  treasurer: DraftMember;
  membershipFee: number;
  // When the yearly fee was called, if within the history.
  feeDate: Date | null;
}

export interface Ledger {
  payments: DraftPayment[];
  invoices: DraftInvoice[];
  adminActions: DraftAdminAction[];
  notifications: DraftNotification[];
  invoiceLastNumber: number;
}

const fullName = (member: DraftMember) =>
  `${member.first_name} ${member.last_name}`;

const TOP_UP_STEPS = [200, 300, 400, 500, 600, 800, 1000, 1200, 1500];

// What a booking moves on its member's account: the charge when booked,
// the refund when cancelled.
export const bookingEvents = (booking: DraftBooking): LedgerEvent[] => {
  if (booking.priceCents <= 0) return [];
  const events: LedgerEvent[] = [
    {
      at: booking.bookedAt,
      member: booking.pilot,
      cents: -booking.priceCents,
      kind: 'booking',
      booking,
      reason: null,
      method: 'account_balance',
    },
  ];
  if (booking.cancelledAt) events.push(refundEvent(booking));
  return events;
};

export const refundEvent = (booking: DraftBooking): LedgerEvent => ({
  at: booking.cancelledAt!,
  member: booking.pilot,
  cents: booking.priceCents,
  kind: 'booking_refund',
  booking,
  reason: null,
  method: 'account_balance',
});

// The yearly fee of the season starting in `feeDate`'s year, called from a
// member at `at`.
export const feeEvent = (
  member: DraftMember,
  at: Date,
  feeCents: number,
  feeDate: Date,
): LedgerEvent => {
  const season = feeDate.getFullYear();
  return {
    at,
    member,
    cents: -feeCents,
    kind: 'manual_debit',
    booking: null,
    reason: `Cotisation annuelle ${season}-${season + 1}`,
    method: 'correction',
  };
};

// The members' accounts as the API keeps them: lines, invoices, the trace
// of entries made by hand and the notifications of recent movements.
export class Accounts {
  readonly payments: DraftPayment[] = [];
  readonly invoices: DraftInvoice[] = [];
  readonly adminActions: DraftAdminAction[] = [];
  readonly notifications: DraftNotification[] = [];

  constructor(
    private readonly rng: Random,
    private readonly now: Date,
    private readonly treasurer: DraftMember,
  ) {}

  private notify(
    member: DraftMember,
    at: Date,
    type: string,
    message: () => string,
    priority: string | null = null,
  ): void {
    const { now, rng } = this;
    if (now.getTime() - at.getTime() >= NOTIFIED_DAYS * DAY) return;
    this.notifications.push({
      member,
      type,
      message,
      date: at,
      read:
        now.getTime() - at.getTime() > 3 * DAY
          ? rng.chance(0.85)
          : rng.chance(0.3),
      priority,
      expiration: null,
    });
  }

  manualEntry(
    member: DraftMember,
    at: Date,
    cents: number,
    method: string,
    reason: string,
    credit: boolean,
  ): DraftPayment {
    const treasurer = this.treasurer;
    const payment: DraftPayment = {
      member,
      kind: credit ? 'manual_credit' : 'manual_debit',
      amountCents: cents,
      date: at,
      method,
      status: 'completed',
      reason,
      booking: null,
      invoice: null,
      createdBy: treasurer,
      externalId: null,
    };
    this.payments.push(payment);
    this.adminActions.push({
      actor: treasurer,
      at: new Date(at.getTime() + 1000),
      action: ADMIN_ACTION.BALANCE_ADJUSTED,
      targetType: 'member',
      targetId: () => String(member.id),
      targetLabel: fullName(member),
      summary: () => ({
        paymentId: payment.id ?? null,
        direction: credit ? 'credit' : 'debit',
        amount: fromCents(cents),
        method,
        reason,
      }),
    });
    this.notify(member, at, credit ? 'PAYMENT_RECEIVED' : 'WITHDRAWAL', () =>
      translate(
        'fr',
        credit ? 'notification.paymentReceived' : 'notification.withdrawal',
        {
          amount: money(cents),
        },
      ),
    );
    return payment;
  }

  topUp(member: DraftMember, at: Date, cents: number): void {
    const rng = this.rng;
    const method =
      member.kind === 'student'
        ? rng.weighted([
            ['transfer', 5],
            ['cheque', 4],
            ['stripe', 3],
          ] as const)
        : rng.weighted([
            ['stripe', 50],
            ['paypal', 6],
            ['transfer', 20],
            ['cheque', 18],
            ['cash', 6],
          ] as const);
    if (method === 'stripe' || method === 'paypal') {
      const invoice: DraftInvoice = {
        member,
        number: '',
        date: at,
        amountCents: cents,
        method,
        lines: () => [{ kind: 'top_up', amount: fromCents(cents), method }],
      };
      this.invoices.push(invoice);
      this.payments.push({
        member,
        kind: 'top_up',
        amountCents: cents,
        date: at,
        method,
        status: 'completed',
        reason: null,
        booking: null,
        invoice,
        createdBy: null,
        externalId:
          method === 'stripe'
            ? `pi_demo_${rng.hex(20)}`
            : `DEMO-PAYPAL-${rng.hex(12).toUpperCase()}`,
      });
      this.notify(member, at, 'INVOICE_CREATED', () =>
        translate('fr', 'notification.invoiceCreated', {
          amount: money(cents),
        }),
      );
      this.notify(member, at, 'PAYMENT_RECEIVED', () =>
        translate('fr', 'notification.paymentReceived', {
          amount: money(cents),
        }),
      );
      return;
    }
    let reason: string;
    if (method === 'cheque') {
      reason = TOP_UP_REASONS.cheque(rng.int(1000000, 9999999));
    } else if (method === 'transfer') {
      reason = TOP_UP_REASONS.transfer(formatDate('fr', at));
    } else {
      reason = TOP_UP_REASONS.cash();
    }
    this.manualEntry(member, at, cents, method, reason, true);
  }

  // Writes a member's events in order, from `balance` after a last line at
  // `previous`: a debit the balance does not cover is preceded by a top-up,
  // as the API refuses it otherwise. Returns the balance after them.
  post(
    member: DraftMember,
    events: LedgerEvent[],
    balance: number,
    previous: number,
  ): { balance: number; previous: number } {
    const rng = this.rng;
    const list = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
    for (const event of list) {
      if (event.cents < 0 && balance + event.cents < 0) {
        const need = -event.cents - balance;
        const step =
          TOP_UP_STEPS.find((value) => value * 100 >= need) ??
          Math.ceil(need / 10000) * 100;
        const amount =
          (rng.chance(0.4)
            ? (TOP_UP_STEPS[TOP_UP_STEPS.indexOf(step) + 1] ?? step)
            : step) * 100;
        const earliest = previous + MINUTE;
        const latest = event.at.getTime() - 5 * MINUTE;
        const wanted = event.at.getTime() - rng.int(1, 72) * HOUR;
        // Always before the debit it pays for.
        const at = new Date(
          Math.min(
            Math.max(earliest, Math.min(latest, wanted)),
            event.at.getTime() - 1000,
          ),
        );
        this.topUp(member, at, amount);
        balance += amount;
      }
      this.line(member, event);
      balance += event.cents;
      previous = event.at.getTime();
    }
    return { balance, previous };
  }

  private line(member: DraftMember, event: LedgerEvent): void {
    if (event.kind === 'manual_debit') {
      this.manualEntry(
        member,
        event.at,
        -event.cents,
        event.method,
        event.reason!,
        false,
      );
      return;
    }
    const payment: DraftPayment = {
      member,
      kind: event.kind,
      amountCents: Math.abs(event.cents),
      date: event.at,
      method: event.method,
      status: 'completed',
      reason: event.reason,
      booking: event.booking,
      invoice: null,
      createdBy: null,
      externalId: null,
    };
    if (event.kind === 'booking') {
      const booking = event.booking!;
      const invoice: DraftInvoice = {
        member,
        number: '',
        date: event.at,
        amountCents: -event.cents,
        method: 'account_balance',
        lines: (): InvoiceLine[] => [
          {
            kind: 'booking',
            amount: fromCents(-event.cents),
            reservationId: booking.id ?? null,
            registration: booking.aircraft.registration,
            start: booking.start.toISOString(),
            end: booking.end.toISOString(),
            instructor: booking.instructor
              ? fullName(booking.instructor)
              : null,
          },
        ],
      };
      this.invoices.push(invoice);
      payment.invoice = invoice;
      this.notify(member, event.at, 'WITHDRAWAL', () =>
        translate('fr', 'notification.withdrawal', {
          amount: money(-event.cents),
        }),
      );
    } else {
      this.notify(member, event.at, 'PAYMENT_REFUNDED', () =>
        translate('fr', 'notification.paymentRefunded', {
          amount: money(event.cents),
        }),
      );
    }
    this.payments.push(payment);
  }

  // Numbers the invoices in the order they were issued, after `last`, and
  // the lines in date order. Returns the last number taken.
  close(last = 0): number {
    this.invoices.sort((a, b) => a.date.getTime() - b.date.getTime());
    this.invoices.forEach((invoice, index) => {
      invoice.number = showcaseInvoiceNumber(invoice.date, last + index + 1);
    });
    this.payments.sort((a, b) => a.date.getTime() - b.date.getTime());
    return last + this.invoices.length;
  }
}

export const showcaseInvoiceNumber = (date: Date, sequence: number): string =>
  `${SHOWCASE_INVOICE_PREFIX}-${formatInvoiceNumber(invoiceYear(date), sequence)}`;

const money = (cents: number) => formatMoney('fr', fromCents(cents));

// Every movement of every member, in order: the balance never goes below
// zero when the API would refuse it (a booking is charged only when the
// balance covers it, a manual debit likewise), and a member who lacks money
// tops up first. The member's balance is the sum of their lines.
export const buildLedger = (input: LedgerInput): Ledger => {
  const { rng, now, members, bookings, treasurer } = input;
  const accounts = new Accounts(rng, now, treasurer);

  const events = new Map<DraftMember, LedgerEvent[]>();
  const push = (event: LedgerEvent) => {
    const list = events.get(event.member) ?? [];
    list.push(event);
    events.set(event.member, list);
  };
  for (const booking of bookings) bookingEvents(booking).forEach(push);
  const feeCents = Math.round(Number(input.membershipFee || 0) * 100);
  if (input.feeDate && feeCents > 0) {
    for (const member of members) {
      const at = new Date(
        Math.max(input.feeDate.getTime(), member.joined.getTime() + 2 * HOUR),
      );
      if (at.getTime() >= now.getTime()) continue;
      push(feeEvent(member, at, feeCents, input.feeDate));
    }
  }

  for (const member of members) {
    let balance = 0;
    let previous = Math.max(
      member.joined.getTime(),
      input.historyStart.getTime() - DAY,
    );

    // The balance carried over from the club's previous tool.
    if (member.joined.getTime() < input.historyStart.getTime()) {
      const opening =
        member.kind === 'technician'
          ? rng.int(0, 1) * 100
          : rng.int(0, 16) * 50;
      if (opening > 0) {
        const at = new Date(input.historyStart.getTime() + 7 * HOUR);
        accounts.manualEntry(
          member,
          at,
          opening * 100,
          'correction',
          `Reprise du solde au ${formatDate('fr', at)} (ancien logiciel)`,
          true,
        );
        balance += opening * 100;
        previous = at.getTime();
      }
    }

    ({ balance, previous } = accounts.post(
      member,
      events.get(member) ?? [],
      balance,
      previous,
    ));

    // Now and then a member tops up ahead of need.
    if (member.kind !== 'technician' && rng.chance(0.35)) {
      const at = new Date(
        now.getTime() - rng.int(2, 20) * DAY - rng.int(0, 8) * HOUR,
      );
      if (at.getTime() > previous) {
        const amount = rng.pick([200, 300, 500]) * 100;
        accounts.topUp(member, at, amount);
        balance += amount;
      }
    }
    member.balanceCents = balance;
  }

  // One online top-up still waiting for the provider: it moves nothing.
  const waiting = members.find((m) => m.kind === 'pilot' && !m.login);
  if (waiting) {
    accounts.payments.push({
      member: waiting,
      kind: 'top_up',
      amountCents: 30000,
      date: new Date(now.getTime() - 25 * MINUTE),
      method: 'stripe',
      status: 'pending',
      reason: null,
      booking: null,
      invoice: null,
      createdBy: null,
      externalId: `pi_demo_${rng.hex(20)}`,
    });
  }

  const invoiceLastNumber = accounts.close();
  return {
    payments: accounts.payments,
    invoices: accounts.invoices,
    adminActions: accounts.adminActions,
    notifications: accounts.notifications,
    invoiceLastNumber,
  };
};

// What a member's balance is from their lines: the sum of what was credited
// less what was taken, completed lines only.
export const balanceOfLines = (
  lines: Pick<DraftPayment, 'kind' | 'amountCents' | 'status'>[],
): number =>
  lines
    .filter((line) => line.status === 'completed')
    .reduce((sum, line) => sum + balanceSign(line.kind) * line.amountCents, 0);
