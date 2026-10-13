import { Column, Entity, PrimaryColumn } from 'typeorm';

// The last invoice number given in a year. One row per year, read and
// raised by a single statement (see invoice-number.ts).
@Entity('invoice_sequences')
export class InvoiceSequence {
  @PrimaryColumn({ type: 'int' })
  year: number;

  @Column({ type: 'int', default: 0 })
  last_number: number;
}
