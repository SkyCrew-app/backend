import { DataSource, IsNull } from 'typeorm';
import { Invoice } from '../../modules/invoices/entity/invoices.entity';
import { nextInvoiceNumber } from '../../modules/invoices/invoice-number';
import { Payment } from '../../modules/payments/entity/payments.entity';
import { User } from '../../modules/users/entity/users.entity';

export const seedDemoInvoicesAndPayments = async (
  dataSource: DataSource,
  users: User[],
): Promise<void> => {
  const invoiceRepository = dataSource.getRepository(Invoice);
  const paymentRepository = dataSource.getRepository(Payment);

  const now = new Date();
  const admin = users[0];
  const pilotes = [users[1], users[4], users[5], users[8], users[9]];

  const demoInvoices = [
    // ===== Factures du compte DEMO ADMIN =====
    {
      user: admin,
      amount: 250.0,
      invoice_date: new Date(now.getFullYear(), 0, 2),
      payment_status: 'Payé',
      payment_method: 'Carte bancaire',
      invoice_items: 'Cotisation annuelle 2026 - SkyCrew Aviation Club',
      amount_paid: 250.0,
      balance_due: 0,
    },
    {
      user: admin,
      amount: 462.0,
      invoice_date: new Date(now.getTime() - 14 * 24 * 3600000),
      payment_status: 'Payé',
      payment_method: 'Solde compte',
      invoice_items: '2.8h de vol Cessna 172 (F-GSKY) @ 165€/h',
      amount_paid: 462.0,
      balance_due: 0,
    },
    {
      user: admin,
      amount: 735.0,
      invoice_date: new Date(now.getTime() - 6 * 24 * 3600000),
      payment_status: 'Payé',
      payment_method: 'Carte bancaire',
      invoice_items: '3.5h de vol Diamond DA40 NG (F-HTBA) @ 210€/h',
      amount_paid: 735.0,
      balance_due: 0,
    },
    {
      user: admin,
      amount: 616.0,
      invoice_date: new Date(now.getTime() - 1 * 24 * 3600000),
      payment_status: 'Payé',
      payment_method: 'PayPal',
      invoice_items: '2.2h de vol Cirrus SR22 (F-GPIL) @ 280€/h',
      amount_paid: 616.0,
      balance_due: 0,
    },
    // ===== Factures des autres pilotes =====
    // Jean - cotisation annuelle payée
    {
      user: pilotes[0],
      amount: 250.0,
      invoice_date: new Date(now.getFullYear(), 0, 5),
      payment_status: 'Payé',
      payment_method: 'Carte bancaire',
      invoice_items: 'Cotisation annuelle 2026 - SkyCrew Aviation Club',
      amount_paid: 250.0,
      balance_due: 0,
    },
    // Jean - heures de vol
    {
      user: pilotes[0],
      amount: 379.5,
      invoice_date: new Date(now.getTime() - 7 * 24 * 3600000),
      payment_status: 'Payé',
      payment_method: 'Solde compte',
      invoice_items: '2.3h de vol Cessna 172 (F-GSKY) @ 165€/h',
      amount_paid: 379.5,
      balance_due: 0,
    },
    // Sophie - cotisation + vol
    {
      user: pilotes[1],
      amount: 250.0,
      invoice_date: new Date(now.getFullYear(), 0, 12),
      payment_status: 'Payé',
      payment_method: 'Virement bancaire',
      invoice_items: 'Cotisation annuelle 2026 - SkyCrew Aviation Club',
      amount_paid: 250.0,
      balance_due: 0,
    },
    {
      user: pilotes[1],
      amount: 280.5,
      invoice_date: new Date(now.getTime() - 1 * 24 * 3600000),
      payment_status: 'Payé',
      payment_method: 'Solde compte',
      invoice_items: '1.7h de vol Cessna 172 (F-GSKY) @ 165€/h',
      amount_paid: 280.5,
      balance_due: 0,
    },
    // Lucas - navigation
    {
      user: pilotes[2],
      amount: 434.0,
      invoice_date: new Date(now.getTime() - 5 * 24 * 3600000),
      payment_status: 'Payé',
      payment_method: 'Carte bancaire',
      invoice_items: '2.8h de vol Piper PA-28 (F-HCRE) @ 155€/h',
      amount_paid: 434.0,
      balance_due: 0,
    },
    // Emma - cours instruction
    {
      user: pilotes[3],
      amount: 290.0,
      invoice_date: new Date(now.getTime() - 3 * 24 * 3600000),
      payment_status: 'En attente',
      payment_method: null,
      invoice_items:
        '1.8h de vol Robin DR400 (F-GAER) @ 145€/h + 1h instruction @ 29€/h',
      amount_paid: 0,
      balance_due: 290.0,
      next_payment_due_date: new Date(now.getTime() + 14 * 24 * 3600000),
    },
    // Antoine - vol touristique
    {
      user: pilotes[4],
      amount: 609.0,
      invoice_date: new Date(now.getTime() - 2 * 24 * 3600000),
      payment_status: 'Payé',
      payment_method: 'PayPal',
      invoice_items: '2.9h de vol Diamond DA40 NG (F-HTBA) @ 210€/h',
      amount_paid: 609.0,
      balance_due: 0,
    },
    // Lucas - cotisation
    {
      user: pilotes[2],
      amount: 250.0,
      invoice_date: new Date(now.getFullYear(), 0, 8),
      payment_status: 'Payé',
      payment_method: 'Carte bancaire',
      invoice_items: 'Cotisation annuelle 2026 - SkyCrew Aviation Club',
      amount_paid: 250.0,
      balance_due: 0,
    },
    // Antoine - cotisation partiellement payée
    {
      user: pilotes[4],
      amount: 250.0,
      invoice_date: new Date(now.getFullYear(), 0, 15),
      payment_status: 'Partiel',
      payment_method: 'Virement bancaire',
      invoice_items: 'Cotisation annuelle 2026 - SkyCrew Aviation Club',
      amount_paid: 125.0,
      balance_due: 125.0,
      next_payment_due_date: new Date(now.getTime() + 30 * 24 * 3600000),
    },
  ];

  const savedInvoices: Invoice[] = [];

  for (const data of demoInvoices) {
    const invoice = invoiceRepository.create(data);
    const saved = await invoiceRepository.save(invoice);
    savedInvoices.push(saved);
  }

  // Create payments for paid invoices
  const demoPayments = [
    // Admin payments (invoices 0-3)
    {
      user: admin,
      invoice: savedInvoices[0],
      amount: 250.0,
      payment_date: new Date(now.getFullYear(), 0, 2),
      payment_method: 'Carte bancaire',
      payment_status: 'Validé',
      external_payment_id: 'pi_demo_admin_001',
    },
    {
      user: admin,
      invoice: savedInvoices[1],
      amount: 462.0,
      payment_date: new Date(now.getTime() - 14 * 24 * 3600000),
      payment_method: 'Solde compte',
      payment_status: 'Validé',
    },
    {
      user: admin,
      invoice: savedInvoices[2],
      amount: 735.0,
      payment_date: new Date(now.getTime() - 6 * 24 * 3600000),
      payment_method: 'Carte bancaire',
      payment_status: 'Validé',
      external_payment_id: 'pi_demo_admin_002',
    },
    {
      user: admin,
      invoice: savedInvoices[3],
      amount: 616.0,
      payment_date: new Date(now.getTime() - 1 * 24 * 3600000),
      payment_method: 'PayPal',
      payment_status: 'Validé',
      external_payment_id: 'PAYID-DEMO-ADMIN-001',
    },
    // Other users payments (indices shifted by 4 admin invoices)
    {
      user: pilotes[0],
      invoice: savedInvoices[4],
      amount: 250.0,
      payment_date: new Date(now.getFullYear(), 0, 5),
      payment_method: 'Carte bancaire',
      payment_status: 'Validé',
      external_payment_id: 'pi_demo_001',
    },
    {
      user: pilotes[0],
      invoice: savedInvoices[5],
      amount: 379.5,
      payment_date: new Date(now.getTime() - 7 * 24 * 3600000),
      payment_method: 'Solde compte',
      payment_status: 'Validé',
    },
    {
      user: pilotes[1],
      invoice: savedInvoices[6],
      amount: 250.0,
      payment_date: new Date(now.getFullYear(), 0, 12),
      payment_method: 'Virement bancaire',
      payment_status: 'Validé',
      external_payment_id: 'vir_demo_001',
    },
    {
      user: pilotes[1],
      invoice: savedInvoices[7],
      amount: 280.5,
      payment_date: new Date(now.getTime() - 1 * 24 * 3600000),
      payment_method: 'Solde compte',
      payment_status: 'Validé',
    },
    {
      user: pilotes[2],
      invoice: savedInvoices[8],
      amount: 434.0,
      payment_date: new Date(now.getTime() - 5 * 24 * 3600000),
      payment_method: 'Carte bancaire',
      payment_status: 'Validé',
      external_payment_id: 'pi_demo_002',
    },
    {
      user: pilotes[4],
      invoice: savedInvoices[10],
      amount: 609.0,
      payment_date: new Date(now.getTime() - 2 * 24 * 3600000),
      payment_method: 'PayPal',
      payment_status: 'Validé',
      external_payment_id: 'PAYID-DEMO001',
    },
    {
      user: pilotes[2],
      invoice: savedInvoices[11],
      amount: 250.0,
      payment_date: new Date(now.getFullYear(), 0, 8),
      payment_method: 'Carte bancaire',
      payment_status: 'Validé',
      external_payment_id: 'pi_demo_003',
    },
    {
      user: pilotes[4],
      invoice: savedInvoices[12],
      amount: 125.0,
      payment_date: new Date(now.getFullYear(), 0, 15),
      payment_method: 'Virement bancaire',
      payment_status: 'Validé',
      external_payment_id: 'vir_demo_002',
    },
  ];

  for (const data of demoPayments) {
    const payment = paymentRepository.create(data);
    await paymentRepository.save(payment);
  }

  console.log(
    `${savedInvoices.length} demo invoices and ${demoPayments.length} demo payments created`,
  );
};

// Demo invoices are written straight to the table, without the number the
// API gives a real one. They get it here, from the same yearly sequence, in
// the order of their dates: "2026-00001", "2026-00002"…
export const numberDemoInvoices = async (
  dataSource: DataSource,
): Promise<number> =>
  dataSource.transaction(async (manager) => {
    const unnumbered = await manager.find(Invoice, {
      where: { invoice_number: IsNull() },
      order: { invoice_date: 'ASC', id: 'ASC' },
      loadEagerRelations: false,
    });
    for (const invoice of unnumbered) {
      await manager.update(
        Invoice,
        { id: invoice.id },
        {
          invoice_number: await nextInvoiceNumber(
            manager,
            new Date(invoice.invoice_date),
          ),
        },
      );
    }
    console.log(`${unnumbered.length} demo invoices numbered`);
    return unnumbered.length;
  });
