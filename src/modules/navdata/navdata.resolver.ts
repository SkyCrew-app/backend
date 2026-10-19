import { UseFilters, UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { NavPointType } from '../navplan/engine/engine';
import { navLogFrequency } from '../navplan/engine/aerodrome';
import {
  AerodromeDetails,
  Airspace,
  NavdataInfo,
  NavPoint,
  Obstacle,
} from '../navplan/graphql/contract.types';
import { RequestLanguage } from '../../common/i18n/request-language';
import { Language } from '../../common/i18n/languages';
import { BBoxInput, LatLonInput } from '../navplan/graphql/contract.inputs';
import { NavPointTypeEnum } from '../navplan/graphql/enums';
import { airspaceView, NavdataService, renderSheet } from './navdata.service';

// Navigation data for the map and the route builder: any member reads it.
@Resolver()
@UseFilters(LocalizedExceptionFilter)
@UseGuards(JwtAuthGuard)
export class NavdataResolver {
  constructor(private readonly navdata: NavdataService) {}

  @Query(() => NavdataInfo)
  navdataInfo() {
    return this.navdata.info();
  }

  @Query(() => [NavPoint])
  navSearch(
    @Args('query') query: string,
    @Args('types', { type: () => [NavPointTypeEnum], nullable: true })
    types: NavPointTypeEnum[] | null,
    // Typed as a plain object so that the global validation pipe leaves an
    // absent argument alone (it would validate an empty object); checked here.
    @Args('near', { type: () => LatLonInput, nullable: true })
    near: { lat: number; lon: number } | null,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
    limit?: number,
  ) {
    const origin =
      near &&
      Number.isFinite(near.lat) &&
      Number.isFinite(near.lon) &&
      Math.abs(near.lat) <= 90 &&
      Math.abs(near.lon) <= 180
        ? near
        : null;
    return this.navdata.search(
      query.slice(0, 64),
      types as NavPointType[],
      origin,
      limit ?? 20,
    );
  }

  @Query(() => [NavPoint])
  navPointsInBox(
    @Args('bbox', { type: () => BBoxInput }) bbox: BBoxInput,
    @Args('types', { type: () => [NavPointTypeEnum], nullable: true })
    types?: NavPointTypeEnum[],
  ) {
    return this.navdata.inBox(bbox, types as NavPointType[]);
  }

  // The aerodrome sheet: AD 2 data with the SIA texts in the reader's
  // language.
  @Query(() => AerodromeDetails, { nullable: true })
  async aerodrome(
    @Args('icao') icao: string,
    @RequestLanguage() language: Language,
  ) {
    const view = await this.navdata.aerodrome(icao.slice(0, 8));
    if (!view) return null;
    const sheet = {
      ...renderSheet(view.sheet, language),
      navLogFrequency: navLogFrequency(view.sheet, 'enroute'),
    };
    return {
      ...view,
      sheet,
      runways: sheet.runways,
      frequencies: sheet.frequencies,
    };
  }

  // Obstacles for the map; refused over a box holding too many (zoom in).
  @Query(() => [Obstacle])
  obstaclesInBox(@Args('bbox', { type: () => BBoxInput }) bbox: BBoxInput) {
    return this.navdata.obstaclesInBox(bbox);
  }

  @Query(() => [Airspace])
  async airspacesInBox(
    @Args('bbox', { type: () => BBoxInput }) bbox: BBoxInput,
    @Args('maxFloorFt', {
      type: () => Int,
      nullable: true,
      defaultValue: 19500,
    })
    maxFloorFt?: number,
  ) {
    return (await this.navdata.airspacesInBox(bbox, maxFloorFt ?? 19500)).map(
      airspaceView,
    );
  }
}
