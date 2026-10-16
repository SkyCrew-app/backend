import { UseFilters, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SessionUser } from '../../../common/auth/access';
import { LocalizedExceptionFilter } from '../../../common/i18n/localized-exception.filter';
import {
  AircraftMassBalance,
  AircraftPerformance,
  AircraftTypeTemplate,
} from '../../navplan/graphql/contract.types';
import {
  AircraftMassBalanceInput,
  AircraftPerformanceInput,
} from '../../navplan/graphql/contract.inputs';
import { AircraftDataService } from './aircraft-data.service';

// Flight manual data of each aircraft: any member reads it, an
// administrator writes and confirms it.
@Resolver()
@UseFilters(LocalizedExceptionFilter)
export class AircraftDataResolver {
  constructor(private readonly service: AircraftDataService) {}

  @Query(() => [AircraftTypeTemplate])
  @UseGuards(JwtAuthGuard)
  aircraftTypeTemplates() {
    return this.service.templates();
  }

  @Query(() => AircraftPerformance, { nullable: true })
  @UseGuards(JwtAuthGuard)
  aircraftPerformance(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
  ) {
    return this.service.getPerformance(aircraftId);
  }

  @Query(() => AircraftMassBalance, { nullable: true })
  @UseGuards(JwtAuthGuard)
  aircraftMassBalance(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
  ) {
    return this.service.getMassBalance(aircraftId);
  }

  @Mutation(() => AircraftPerformance)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  applyAircraftTemplate(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @Args('templateCode') templateCode: string,
  ) {
    return this.service.applyTemplate(aircraftId, templateCode);
  }

  @Mutation(() => AircraftPerformance)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  saveAircraftPerformance(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @Args('input') input: AircraftPerformanceInput,
  ) {
    return this.service.savePerformance(aircraftId, input);
  }

  @Mutation(() => AircraftMassBalance)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  saveAircraftMassBalance(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @Args('input') input: AircraftMassBalanceInput,
  ) {
    return this.service.saveMassBalance(aircraftId, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  validateAircraftData(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.validate(aircraftId, user);
  }
}
