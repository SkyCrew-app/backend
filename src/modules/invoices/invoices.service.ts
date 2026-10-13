import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entity/invoices.entity';
import { CreateInvoiceInput } from './dto/create-invoice.input';
import { UpdateInvoiceInput } from './dto/update-invoice.input';
import { nextInvoiceNumber } from './invoice-number';
import { invoiceFileName, renderInvoicePdf } from './invoice-pdf';
import { Administration } from '../administration/entity/admin.entity';
import { Language } from '../../common/i18n/languages';
import { localized } from '../../common/i18n/localized-exception';

export interface InvoiceDocumentFile {
  fileName: string;
  // The PDF, in base64.
  content: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
  ) {}

  // The invoice and its number are written in one transaction.
  async create(createInvoiceInput: CreateInvoiceInput): Promise<Invoice> {
    // user_id is not a column: the invoice is attached through its relation.
    const { user_id, ...fields } = createInvoiceInput;
    return this.invoicesRepository.manager.transaction(async (manager) =>
      manager.save(
        Invoice,
        manager.create(Invoice, {
          ...fields,
          user: { id: user_id },
          payment_status: 'paid',
          invoice_number: await nextInvoiceNumber(
            manager,
            fields.invoice_date ? new Date(fields.invoice_date) : new Date(),
          ),
        }),
      ),
    );
  }

  async findAll(): Promise<Invoice[]> {
    return this.invoicesRepository.find({
      relations: ['user', 'payments'],
    });
  }

  async findOne(id: number): Promise<Invoice> {
    return this.invoicesRepository.findOne({
      where: { id },
      relations: ['user', 'payments'],
    });
  }

  async update(
    id: number,
    updateInvoiceInput: UpdateInvoiceInput,
  ): Promise<Invoice> {
    await this.invoicesRepository.update(id, updateInvoiceInput);
    return this.findOne(id);
  }

  // A numbered invoice is never deleted: its number would be missing from
  // the year's sequence.
  async remove(id: number): Promise<boolean> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) {
      return false;
    }
    if (invoice.invoice_number) {
      throw localized(ConflictException, 'error.invoice.numberedCannotDelete');
    }
    const result = await this.invoicesRepository.delete(id);
    return result.affected > 0;
  }

  async findByUser(userId: number): Promise<Invoice[]> {
    return this.invoicesRepository.find({
      where: { user: { id: userId } },
      relations: ['payments'],
      order: { invoice_date: 'DESC', id: 'DESC' },
    });
  }

  // The invoice as a PDF, written in the language of the person asking.
  async document(
    invoice: Invoice,
    language: Language,
  ): Promise<InvoiceDocumentFile> {
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const [club] = await this.invoicesRepository.manager
      .getRepository(Administration)
      .find({ order: { id: 'ASC' }, take: 1 });
    const bytes = await renderInvoicePdf(invoice, club, language);
    return {
      fileName: invoiceFileName(invoice, language),
      content: Buffer.from(bytes).toString('base64'),
    };
  }
}
