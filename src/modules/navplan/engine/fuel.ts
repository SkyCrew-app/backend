import { CheckStatus, MessageRef } from './types';

// Final reserve fuel, Part-NCO.
//
// NCO.OP.125 (Regulation (EU) No 965/2012 as amended by Regulation (EU)
// 2021/1296, applicable since 30 October 2022) states no minutes: the pilot
// in command takes enough fuel for the flight plus a final reserve fuel
// matched to the risk of an emergency landing. The minutes are in
// AMC1 NCO.OP.125(b) (EASA ED Decision 2022/005/R, AMC & GM to Part-NCO,
// Issue 2 Amendment 12): for aeroplanes, a final reserve fuel of at least
//   (a)(1) 10 minutes at maximum continuous cruise power at 1500 ft above
//          the destination, VFR by day, taking off and landing at the same
//          aerodrome and always remaining within sight of it;
//   (a)(2) 30 minutes at holding speed at 1500 ft above the destination,
//          VFR by day;
//   (a)(3) 45 minutes at holding speed at 1500 ft above the destination or
//          alternate, VFR by night and IFR.
// Texts read on easa.europa.eu (downloads/136242) and on the UK CAA copy of
// the consolidated regulation; to be re-read on EUR-Lex before service.
// GM2 NCO.OP.125: without holding data, use the fuel flow for maximum
// endurance / economical cruise.
export type ReserveCase = 'VFR_DAY_LOCAL' | 'VFR_DAY' | 'VFR_NIGHT';

export const AMC_FINAL_RESERVE_MIN: Record<ReserveCase, number> = {
  VFR_DAY_LOCAL: 10,
  VFR_DAY: 30,
  VFR_NIGHT: 45,
};

export interface FuelSettings {
  reserveVfrDayLocalMin: number;
  reserveVfrDayMin: number;
  reserveVfrNightMin: number;
  contingencyPercent: number;
  contingencyMinL: number;
  alternateRequiredVfr: boolean;
  clubMarginMin: number;
}

export const DEFAULT_FUEL_SETTINGS: FuelSettings = {
  reserveVfrDayLocalMin: AMC_FINAL_RESERVE_MIN.VFR_DAY_LOCAL,
  reserveVfrDayMin: AMC_FINAL_RESERVE_MIN.VFR_DAY,
  reserveVfrNightMin: AMC_FINAL_RESERVE_MIN.VFR_NIGHT,
  contingencyPercent: 0,
  contingencyMinL: 0,
  alternateRequiredVfr: false,
  clubMarginMin: 0,
};

// A club may only be more prudent than the AMC.
export function fuelSettingsProblems(settings: FuelSettings): MessageRef[] {
  const problems: MessageRef[] = [];
  const check = (value: number, minimum: number, label: string) => {
    if (!Number.isFinite(value) || value < minimum) {
      problems.push({
        key: 'error.navplan.reserveBelowAmc',
        params: { label, minimum },
      });
    }
  };
  check(
    settings.reserveVfrDayLocalMin,
    AMC_FINAL_RESERVE_MIN.VFR_DAY_LOCAL,
    'VFR_DAY_LOCAL',
  );
  check(settings.reserveVfrDayMin, AMC_FINAL_RESERVE_MIN.VFR_DAY, 'VFR_DAY');
  check(
    settings.reserveVfrNightMin,
    AMC_FINAL_RESERVE_MIN.VFR_NIGHT,
    'VFR_NIGHT',
  );
  return problems;
}

export interface FuelInput {
  reserveCase: ReserveCase;
  settings: FuelSettings;
  taxiL: number;
  tripL: number;
  alternateL: number; // 0 without alternate
  hasAlternate: boolean;
  arrivalFuelL: number; // circuit / joining allowance, part of the trip
  holdingFuelFlowLph: number;
  maxContinuousFuelFlowLph: number;
  cruiseFuelFlowLph: number;
  loadedL: number;
  usableL: number;
}

export interface FuelPlan {
  taxiL: number;
  tripL: number;
  contingencyL: number;
  alternateL: number;
  finalReserveL: number;
  finalReserveMin: number;
  clubMarginL: number;
  minimumBlockL: number;
  loadedL: number;
  extraL: number;
  landingL: number;
  landingAtAlternateL: number | null;
  usableL: number;
  enduranceMin: number;
  status: CheckStatus;
  messages: MessageRef[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function planFuel(input: FuelInput): FuelPlan {
  const { settings } = input;
  const messages: MessageRef[] = [];
  let status: CheckStatus = 'OK';

  const reserveMin =
    input.reserveCase === 'VFR_DAY_LOCAL'
      ? Math.max(
          settings.reserveVfrDayLocalMin,
          AMC_FINAL_RESERVE_MIN.VFR_DAY_LOCAL,
        )
      : input.reserveCase === 'VFR_NIGHT'
        ? Math.max(settings.reserveVfrNightMin, AMC_FINAL_RESERVE_MIN.VFR_NIGHT)
        : Math.max(settings.reserveVfrDayMin, AMC_FINAL_RESERVE_MIN.VFR_DAY);
  const reserveFlow =
    input.reserveCase === 'VFR_DAY_LOCAL'
      ? input.maxContinuousFuelFlowLph
      : input.holdingFuelFlowLph;
  const finalReserveL = (reserveMin / 60) * reserveFlow;

  const tripL = input.tripL + input.arrivalFuelL;
  const contingencyL = Math.max(
    (tripL * settings.contingencyPercent) / 100,
    settings.contingencyMinL,
  );
  const alternateL = input.hasAlternate ? input.alternateL : 0;
  if (settings.alternateRequiredVfr && !input.hasAlternate) {
    status = 'BLOCKING';
    messages.push({ key: 'navplan.fuel.alternateRequired' });
  }
  const clubMarginL = (settings.clubMarginMin / 60) * input.cruiseFuelFlowLph;
  const minimumBlockL =
    input.taxiL +
    tripL +
    contingencyL +
    alternateL +
    finalReserveL +
    clubMarginL;

  const landingL = input.loadedL - input.taxiL - tripL;
  const landingAtAlternateL = input.hasAlternate ? landingL - alternateL : null;

  if (input.loadedL > input.usableL + 1e-9) {
    status = 'BLOCKING';
    messages.push({
      key: 'navplan.fuel.aboveUsable',
      params: { loaded: round1(input.loadedL), usable: round1(input.usableL) },
    });
  }
  if (input.loadedL < minimumBlockL - 1e-9) {
    status = 'BLOCKING';
    messages.push({
      key: 'navplan.fuel.insufficient',
      params: {
        missing: round1(minimumBlockL - input.loadedL),
        minimum: round1(minimumBlockL),
      },
    });
  }
  const landingCheck = landingAtAlternateL ?? landingL;
  if (landingCheck < finalReserveL - 1e-9) {
    status = 'BLOCKING';
    messages.push({
      key: 'navplan.fuel.landingBelowReserve',
      params: { landing: round1(landingCheck), reserve: round1(finalReserveL) },
    });
  }

  const enduranceMin =
    input.cruiseFuelFlowLph > 0
      ? ((input.loadedL - input.taxiL) / input.cruiseFuelFlowLph) * 60
      : 0;

  return {
    taxiL: input.taxiL,
    tripL,
    contingencyL,
    alternateL,
    finalReserveL,
    finalReserveMin: reserveMin,
    clubMarginL,
    minimumBlockL,
    loadedL: input.loadedL,
    extraL: input.loadedL - minimumBlockL,
    landingL,
    landingAtAlternateL,
    usableL: input.usableL,
    enduranceMin,
    status,
    messages,
  };
}
