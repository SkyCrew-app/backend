import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entity/invoices.entity';
import { CreateInvoiceInput } from './dto/create-invoice.input';
import { UpdateInvoiceInput } from './dto/update-invoice.input';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
  ) {}

  async create(createInvoiceInput: CreateInvoiceInput): Promise<Invoice> {
    const invoice = this.invoicesRepository.create({
      ...createInvoiceInput,
      payment_status: 'paid',
    });
    return this.invoicesRepository.save(invoice);
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

  async remove(id: number): Promise<boolean> {
    const result = await this.invoicesRepository.delete(id);
    return result.affected > 0;
  }

  async findByUser(userId: number): Promise<Invoice[]> {
    return this.invoicesRepository.find({
      where: { user: { id: userId } },
      relations: ['payments'],
    });
  }
}
