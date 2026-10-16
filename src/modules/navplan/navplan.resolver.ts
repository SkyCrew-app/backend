import { UseFilters, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionUser } from '../../common/auth/access';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { RequestLanguage } from '../../common/i18n/request-language';
import { Language } from '../../common/i18n/languages';
import {
  FlightPlan,
  FlightPlanningSettings,
  FlightPlanResult,
} from './graphql/contract.types';
import {
  FlightPlanInput,
  FlightPlanningSettingsInput,
} from './graphql/contract.inputs';
import { PdfFormatEnum } from './graphql/enums';
import { NavplanService } from './navplan.service';

// Flight plans: computed for any member (no write), saved on the member's
// own booking (an administrator for anyone), read by the pilot, an
// administrator or the pilot's instructor. Club settings: administrators.
@Resolver()
@UseFilters(LocalizedExceptionFilter)
export class NavplanResolver {
  constructor(private readonly navplan: NavplanService) {}

  @Query(() => FlightPlanningSettings)
  @UseGuards(JwtAuthGuard)
  flightPlanningSettings() {
    return this.navplan.settings();
  }

  @Mutation(() => FlightPlanningSettings)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  saveFlightPlanningSettings(
    @Args('input') input: FlightPlanningSettingsInput,
  ) {
    return this.navplan.saveSettings(input);
  }

  @Query(() => FlightPlanResult)
  @UseGuards(JwtAuthGuard)
  computeFlightPlan(
    @Args('input') input: FlightPlanInput,
    @RequestLanguage() language: Language,
  ) {
    return this.navplan.computeRendered(input, language);
  }

  @Query(() => FlightPlan, { nullable: true })
  @UseGuards(JwtAuthGuard)
  flightPlan(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: SessionUser,
    @RequestLanguage() language: Language,
  ) {
    return this.navplan.findOne(id, user, language);
  }

  @Query(() => FlightPlan, { nullable: true })
  @UseGuards(JwtAuthGuard)
  flightPlanByFlight(
    @Args('flightId', { type: () => Int }) flightId: number,
    @CurrentUser() user: SessionUser,
    @RequestLanguage() language: Language,
  ) {
    return this.navplan.findByFlight(flightId, user, language);
  }

  @Mutation(() => FlightPlan)
  @UseGuards(JwtAuthGuard)
  saveFlightPlan(
    @Args('input') input: FlightPlanInput,
    @Args('flightPlanId', { type: () => Int, nullable: true })
    flightPlanId: number | null,
    @CurrentUser() user: SessionUser,
    @RequestLanguage() language: Language,
  ) {
    return this.navplan.save(input, flightPlanId, user, language);
  }

  // Base64 of the PDF, like exportFlightRecapPDF.
  @Mutation(() => String)
  @UseGuards(JwtAuthGuard)
  exportFlightPlanPdf(
    @Args('flightPlanId', { type: () => Int }) flightPlanId: number,
    @Args('format', { type: () => PdfFormatEnum }) format: PdfFormatEnum,
    @CurrentUser() user: SessionUser,
    @RequestLanguage() language: Language,
  ) {
    return this.navplan.exportPdf(flightPlanId, format, user, language);
  }
}
