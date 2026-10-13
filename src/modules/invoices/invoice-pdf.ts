import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { Language, formatDate } from '../../common/i18n/languages';
import { renderTranslation, translate } from '../../common/i18n/translate';
import { TranslationKey } from '../../common/i18n/fr';
import { mailDate } from '../reservations/booking-rules';
import { Invoice } from './entity/invoices.entity';
import { InvoiceLine, parseInvoiceLines } from './invoice-number';

export interface InvoiceIssuer {
  clubName?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

const METHOD_KEYS: Record<string, TranslationKey> = {
  account_balance: 'invoice.method.accountBalance',
  stripe: 'invoice.method.card',
  paypal: 'invoice.method.paypal',
  cash: 'invoice.method.cash',
  cheque: 'invoice.method.cheque',
  transfer: 'invoice.method.transfer',
};

// The standard PDF fonts only know the Windows-1252 characters: anything
// else (narrow spaces of formatted dates, emoji in a name) would make the
// whole document fail.
const printable = (text: unknown): string =>
  String(text ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e¡-ÿ€’‘“”–—…œŒ]/g, '?');

export const invoiceMoney = (amount: number | string, language: Language) => {
  const value = Number(amount ?? 0).toFixed(2);
  return language === 'fr' ? `${value.replace('.', ',')} €` : `€${value}`;
};

export const invoiceLineLabel = (
  line: InvoiceLine,
  language: Language,
): string => {
  if (line.kind === 'booking') {
    if (line.registration && line.start && line.end) {
      const details = {
        registration: line.registration,
        start: mailDate(line.start, language),
        end: mailDate(line.end, language),
      };
      // A flight with an instructor says so, and with whom.
      return line.instructor
        ? translate(language, 'invoice.line.instructionBooking', {
            ...details,
            instructor: line.instructor,
          })
        : translate(language, 'invoice.line.booking', details);
    }
    return line.reservationId != null
      ? translate(language, 'invoice.line.bookingNumber', {
          reservationId: line.reservationId,
        })
      : translate(language, 'invoice.line.bookingPlain');
  }
  if (line.kind === 'top_up') {
    return translate(language, 'invoice.line.topUp');
  }
  return line.label || translate(language, 'invoice.line.other');
};

// The lines of an invoice; one made before lines were stored is described
// by its payment method.
export const invoiceLines = (invoice: Invoice): InvoiceLine[] => {
  const lines = parseInvoiceLines(invoice.invoice_items);
  if (lines.length > 0) {
    return lines;
  }
  const amount = Number(invoice.amount);
  return invoice.payment_method === 'account_balance'
    ? [{ kind: 'booking', amount }]
    : invoice.payment_method === 'stripe' || invoice.payment_method === 'paypal'
      ? [{ kind: 'top_up', amount, method: invoice.payment_method }]
      : [{ kind: 'other', amount }];
};

export const invoiceFileName = (invoice: Invoice, language: Language) =>
  `${translate(language, 'invoice.fileName')}-${invoice.invoice_number ?? invoice.id}.pdf`;

const wrap = (text: string, font: PDFFont, size: number, width: number) => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

export const renderInvoicePdf = async (
  invoice: Invoice,
  issuer: InvoiceIssuer | null | undefined,
  language: Language,
): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  const left = 50;
  const right = 545;
  let y = 790;

  const write = (
    text: string,
    options: {
      x?: number;
      size?: number;
      bold?: boolean;
      alignRight?: boolean;
    } = {},
  ) => {
    const size = options.size ?? 10;
    const face = options.bold ? bold : font;
    const content = printable(text);
    const x = options.alignRight
      ? right - face.widthOfTextAtSize(content, size)
      : (options.x ?? left);
    page.drawText(content, {
      x,
      y,
      size,
      font: face,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  write(issuer?.clubName || 'SkyCrew', { size: 16, bold: true });
  write(translate(language, 'invoice.title'), {
    size: 16,
    bold: true,
    alignRight: true,
  });
  y -= 18;
  for (const detail of [
    issuer?.address,
    issuer?.contactEmail,
    issuer?.contactPhone,
  ]) {
    if (!detail) continue;
    write(detail, { size: 9 });
    y -= 12;
  }

  y -= 16;
  write(
    translate(language, 'invoice.number', {
      number: invoice.invoice_number ?? String(invoice.id),
    }),
    { bold: true, size: 11 },
  );
  y -= 14;
  write(
    translate(language, 'invoice.date', {
      date: formatDate(language, invoice.invoice_date),
    }),
  );

  y -= 28;
  write(translate(language, 'invoice.billedTo'), { bold: true });
  y -= 14;
  const member = invoice.user;
  write([member?.first_name, member?.last_name].filter(Boolean).join(' '));
  y -= 12;
  for (const detail of [member?.address, member?.email]) {
    if (!detail) continue;
    write(detail, { size: 9 });
    y -= 12;
  }

  y -= 24;
  write(translate(language, 'invoice.description'), { bold: true });
  write(translate(language, 'invoice.amount'), {
    bold: true,
    alignRight: true,
  });
  y -= 6;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  y -= 16;

  const lines = invoiceLines(invoice);
  for (const line of lines) {
    const label = wrap(
      printable(invoiceLineLabel(line, language)),
      font,
      10,
      380,
    );
    // A line without its own amount (free text) carries the invoice total.
    const amount = lines.length === 1 ? invoice.amount : line.amount;
    write(label[0] ?? '');
    write(invoiceMoney(amount, language), { alignRight: true });
    for (const rest of label.slice(1)) {
      y -= 12;
      write(rest);
    }
    y -= 16;
  }

  page.drawLine({
    start: { x: left, y: y + 6 },
    end: { x: right, y: y + 6 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  y -= 10;
  write(translate(language, 'invoice.total'), { bold: true, x: 380 });
  write(invoiceMoney(invoice.amount, language), {
    bold: true,
    alignRight: true,
  });
  y -= 16;
  write(translate(language, 'invoice.amountPaid'), { x: 380 });
  write(invoiceMoney(invoice.amount_paid, language), { alignRight: true });
  y -= 16;
  write(translate(language, 'invoice.balanceDue'), { x: 380 });
  write(invoiceMoney(invoice.balance_due, language), { alignRight: true });

  const methodKey = METHOD_KEYS[invoice.payment_method];
  if (methodKey) {
    y -= 28;
    write(
      translate(language, 'invoice.paidBy', {
        method: renderTranslation(language, methodKey),
      }),
    );
  }

  return pdf.save();
};
