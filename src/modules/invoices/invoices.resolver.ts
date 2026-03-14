// invoices.resolver.ts
import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { Invoice } from './entity/invoices.entity';
import { CreateInvoiceInput } from './dto/create-invoice.input';
import { UpdateInvoiceInput } from './dto/update-invoice.input';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver(() => Invoice)
export class InvoicesResolver {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Mutation(() => Invoice)
  @UseGuards(JwtAuthGuard)
  createInvoice(
    @Args('createInvoiceInput') createInvoiceInput: CreateInvoiceInput,
  ) {
    return this.invoicesService.create(createInvoiceInput);
  }

  @Query(() => [Invoice], { name: 'invoices' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.invoicesService.findAll();
  }

  @Query(() => Invoice, { name: 'invoice' })
  @UseGuards(JwtAuthGuard)
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.invoicesService.findOne(id);
  }

  @Mutation(() => Invoice)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  updateInvoice(
    @Args('updateInvoiceInput') updateInvoiceInput: UpdateInvoiceInput,
  ) {
    return this.invoicesService.update(
      updateInvoiceInput.id,
      updateInvoiceInput,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  removeInvoice(@Args('id', { type: () => Int }) id: number) {
    return this.invoicesService.remove(id);
  }

  @Query(() => [Invoice])
  @UseGuards(JwtAuthGuard)
  invoicesByUser(@Args('userId', { type: () => Int }) userId: number) {
    return this.invoicesService.findByUser(userId);
  }
}
