import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LogbookService } from './logbook.service';
import { Flight } from './entity/flights.entity';
import { LogbookFilterInput } from './dto/logbook-filter.input';
import { LogbookStats } from './dto/logbook-stats.type';
import { User } from '../users/entity/users.entity';

@Resolver()
export class LogbookResolver {
  constructor(private readonly logbookService: LogbookService) {}

  @Query(() => [Flight], { name: 'logbookEntries' })
  @UseGuards(JwtAuthGuard)
  getLogbookEntries(
    @CurrentUser() user: User,
    @Args('filter', { type: () => LogbookFilterInput, nullable: true })
    filter?: LogbookFilterInput,
  ): Promise<Flight[]> {
    return this.logbookService.getLogbookEntries(user.id, filter);
  }

  @Query(() => LogbookStats, { name: 'logbookStats' })
  @UseGuards(JwtAuthGuard)
  getLogbookStats(
    @CurrentUser() user: User,
    @Args('filter', { type: () => LogbookFilterInput, nullable: true })
    filter?: LogbookFilterInput,
  ): Promise<LogbookStats> {
    return this.logbookService.getLogbookStats(user.id, filter);
  }

  @Mutation(() => String, { name: 'exportLogbookPDF' })
  @UseGuards(JwtAuthGuard)
  exportLogbookPDF(
    @CurrentUser() user: User,
    @Args('filter', { type: () => LogbookFilterInput, nullable: true })
    filter?: LogbookFilterInput,
  ): Promise<string> {
    return this.logbookService.generateDGACPdf(user.id, filter);
  }
}
