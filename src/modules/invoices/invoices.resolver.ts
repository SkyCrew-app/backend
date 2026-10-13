// invoices.resolver.ts
import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ObjectType,
  Field,
} from '@nestjs/graphql';
import { NotFoundException, UseFilters, UseGuards } from '@nestjs/common';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { RequestLanguage } from '../../common/i18n/request-language';
import { Language } from '../../common/i18n/languages';
import { InvoicesService } from './invoices.service';
import { Invoice } from './entity/invoices.entity';
import { CreateInvoiceInput } from './dto/create-invoice.input';
import { UpdateInvoiceInput } from './dto/update-invoice.input';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertSelfOrRole, SessionUser } from '../../common/auth/access';

@ObjectType()
export class InvoiceDocument {
  @Field()
  fileName: string;

  // The PDF, in base64.
  @Field()
  content: string;
}

@Resolver(() => Invoice)
@UseFilters(LocalizedExceptionFilter)
export class InvoicesResolver {
  constructor(private readonly invoicesService: InvoicesService) {}

  // Invoices are issued by the application or by an administrator.
  @Mutation(() => Invoice)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
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
  async findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const invoice = await this.invoicesService.findOne(id);
    if (invoice) {
      assertSelfOrRole(currentUser, invoice.user?.id);
    }
    return invoice;
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
  invoicesByUser(
    @Args('userId', { type: () => Int }) userId: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    assertSelfOrRole(currentUser, userId);
    return this.invoicesService.findByUser(userId);
  }

  // The invoice as a PDF, for the member it was issued to (or an
  // administrator), in the language of the interface.
  @Query(() => InvoiceDocument, { name: 'invoiceDocument' })
  @UseGuards(JwtAuthGuard)
  async invoiceDocument(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
    @RequestLanguage() language?: Language,
  ): Promise<InvoiceDocument> {
    const invoice = await this.invoicesService.findOne(id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    assertSelfOrRole(currentUser, invoice.user?.id);
    return this.invoicesService.document(invoice, language ?? 'fr');
  }
}
