import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoices.service';
import { InvoicesResolver } from './invoices.resolver';
import { Invoice } from './entity/invoices.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice])],
  providers: [InvoicesResolver, InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
