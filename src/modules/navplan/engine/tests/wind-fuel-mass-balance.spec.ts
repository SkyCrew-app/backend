import {
  solveWindTriangle,
  WindTriangleError,
  componentsToWind,
  windToComponents,
} from '../wind-triangle';
import { DEFAULT_FUEL_SETTINGS, fuelSettingsProblems, planFuel } from '../fuel';
import { burnFuel, computeMassBalance, stateOf } from '../mass-balance';
import { MassBalanceData } from '../types';

describe('wind triangle (CRP-5 checkable)', () => {
  it.each([
    [90, 100, 360, 20, -11.54, 78.46, 97.98],
    [0, 100, 0, 20, 0, 0, 80.0],
    [0, 100, 180, 20, 0, 0, 120.0],
    [45, 105, 270, 25, -9.69, 35.31, 121.18],
    [270, 90, 300, 30, 9.59, 279.59, 62.76],
    [180, 95, 90, 15, -9.08, 170.92, 93.81],
  ])(
    'Rv %d TAS %d wind %d/%d: WCA %f, Cv %f, GS %f',
    (course, tas, from, speed, wca, heading, gs) => {
      const result = solveWindTriangle(course, tas, from, speed);
      expect(Math.abs(result.windCorrectionDeg - wca)).toBeLessThanOrEqual(
        0.01,
      );
      expect(Math.abs(result.trueHeadingDeg - heading)).toBeLessThanOrEqual(
        0.01,
      );
      expect(Math.abs(result.groundSpeedKt - gs)).toBeLessThanOrEqual(0.01);
    },
  );

  it('refuses a crosswind at least equal to the TAS', () => {
    expect(() => solveWindTriangle(0, 60, 90, 70)).toThrow(WindTriangleError);
  });

  it('combines winds as vectors: 350/20 and 010/20 average to 360, not 180', () => {
    const a = windToComponents(350, 20);
    const b = windToComponents(10, 20);
    const mean = componentsToWind((a.u + b.u) / 2, (a.v + b.v) / 2);
    expect(mean.fromDeg % 360).toBeCloseTo(0, 6);
  });
});

describe('fuel (AMC1 NCO.OP.125(b))', () => {
  // Cruise 28 L/h, holding 24 L/h, max continuous 34 L/h, taxi 3 L, usable
  // 107 L, trip 37.33 L (1 h 20 at 28 L/h).
  const base = {
    reserveCase: 'VFR_DAY' as const,
    settings: DEFAULT_FUEL_SETTINGS,
    taxiL: 3,
    tripL: (80 / 60) * 28,
    alternateL: 0,
    hasAlternate: false,
    arrivalFuelL: 0,
    holdingFuelFlowLph: 24,
    maxContinuousFuelFlowLph: 34,
    cruiseFuelFlowLph: 28,
    loadedL: 100,
    usableL: 107,
  };
  const r1 = (v: number) => Math.round(v * 10) / 10;

  it('1 VFR day: reserve 30 min x 24 = 12.0 L, minimum 52.3 L', () => {
    const plan = planFuel(base);
    expect(plan.finalReserveL).toBeCloseTo(12, 6);
    expect(r1(plan.minimumBlockL)).toBe(52.3);
    expect(plan.status).toBe('OK');
  });

  it('2 VFR day local in sight: 10 min x 34 = 5.67 L, minimum 46.0 L', () => {
    const plan = planFuel({ ...base, reserveCase: 'VFR_DAY_LOCAL' });
    expect(plan.finalReserveL).toBeCloseTo(5.667, 3);
    expect(r1(plan.minimumBlockL)).toBe(46.0);
  });

  it('3 VFR night: 45 min x 24 = 18.0 L, minimum 58.3 L', () => {
    const plan = planFuel({ ...base, reserveCase: 'VFR_NIGHT' });
    expect(plan.finalReserveL).toBeCloseTo(18, 6);
    expect(r1(plan.minimumBlockL)).toBe(58.3);
  });

  it('4 club contingency 10 %: + 3.73 L, minimum 56.1 L', () => {
    const plan = planFuel({
      ...base,
      settings: { ...DEFAULT_FUEL_SETTINGS, contingencyPercent: 10 },
    });
    expect(plan.contingencyL).toBeCloseTo(3.733, 3);
    expect(r1(plan.minimumBlockL)).toBe(56.1);
  });

  it('5 alternate 20 min at 28 L/h: + 9.33 L, minimum 61.7 L', () => {
    const plan = planFuel({
      ...base,
      hasAlternate: true,
      alternateL: (20 / 60) * 28,
    });
    expect(r1(plan.minimumBlockL)).toBe(61.7);
  });

  it('6 loaded 50 L: insufficient by 2.3 L, landing 9.7 L under the 12.0 L reserve', () => {
    const plan = planFuel({ ...base, loadedL: 50 });
    expect(plan.status).toBe('BLOCKING');
    expect(plan.messages).toEqual(
      expect.arrayContaining([
        {
          key: 'navplan.fuel.insufficient',
          params: { missing: 2.3, minimum: 52.3 },
        },
        {
          key: 'navplan.fuel.landingBelowReserve',
          params: { landing: 9.7, reserve: 12 },
        },
      ]),
    );
  });

  it('7 loaded 120 L: above the 107 L usable', () => {
    const plan = planFuel({ ...base, loadedL: 120 });
    expect(plan.status).toBe('BLOCKING');
    expect(plan.messages).toContainEqual({
      key: 'navplan.fuel.aboveUsable',
      params: { loaded: 120, usable: 107 },
    });
  });

  it('8 a club setting under the AMC (20 min VFR day) is refused', () => {
    expect(
      fuelSettingsProblems({ ...DEFAULT_FUEL_SETTINGS, reserveVfrDayMin: 20 }),
    ).toHaveLength(1);
    expect(fuelSettingsProblems(DEFAULT_FUEL_SETTINGS)).toHaveLength(0);
    // Even a lower setting stored by other means is never applied.
    const plan = planFuel({
      ...base,
      settings: { ...DEFAULT_FUEL_SETTINGS, reserveVfrDayMin: 20 },
    });
    expect(plan.finalReserveMin).toBe(30);
  });
});

describe('mass and balance (F-TEST, fictitious)', () => {
  const data: MassBalanceData = {
    emptyMassKg: 560,
    emptyArmM: 0.335,
    weighingDate: '2026-01-01',
    mtowKg: 1000,
    mlwKg: 1000,
    stations: [
      { id: 'front', label: 'Sièges AV', kind: 'SEAT', armM: 0.41 },
      { id: 'rear', label: 'Sièges AR', kind: 'SEAT', armM: 1.19 },
      {
        id: 'baggage',
        label: 'Bagages',
        kind: 'BAGGAGE',
        armM: 1.9,
        maxKg: 60,
      },
    ],
    combinedLimits: [],
    envelopes: [
      {
        category: 'NORMAL',
        points: [
          { armM: 0.205, massKg: 550 },
          { armM: 0.205, massKg: 780 },
          { armM: 0.427, massKg: 900 },
          { armM: 0.564, massKg: 900 },
          { armM: 0.564, massKg: 550 },
        ],
      },
    ],
  };
  const compute = (
    loads: Record<string, number>,
    takeoffL: number,
    landingL = takeoffL,
  ) =>
    computeMassBalance({
      data,
      loads: Object.entries(loads).map(([stationId, massKg]) => ({
        stationId,
        massKg,
      })),
      fuelTakeoffL: { main: takeoffL },
      fuelLandingL: { main: landingL },
      fuelArmByTank: { main: 1.12 },
      fuelLabelByTank: { main: 'Réservoir' },
      densityKgPerL: 0.72,
      category: 'NORMAL',
    });

  it('1 front 160, rear 75, baggage 10, 80 L: 862.6 kg, 425.962 kg·m, CG 0.4938; landing after 40 L 833.8 kg', () => {
    const result = compute({ front: 160, rear: 75, baggage: 10 }, 80, 40);
    expect(result.takeoff.massKg).toBeCloseTo(862.6, 6);
    expect(result.takeoff.momentKgm).toBeCloseTo(425.962, 6);
    expect(result.takeoff.cgM).toBeCloseTo(0.4938, 4);
    expect(result.takeoff.withinEnvelope).toBe(true);
    expect(result.landing.massKg).toBeCloseTo(833.8, 6);
    expect(result.landing.momentKgm).toBeCloseTo(393.706, 6);
    expect(result.landing.cgM).toBeCloseTo(0.4722, 4);
    expect(result.status).toBe('OK');
    // The forward limit at 862.6 kg is 0.3578 m (sloping edge).
    expect(result.takeoff.marginCgMm).toBeCloseTo((0.564 - 0.4938) * 1000, 0);
  });

  it('2 front 170, rear 160, baggage 40, 110 L: 1009.2 kg, CG 0.6068: blocking, two messages', () => {
    const result = compute({ front: 170, rear: 160, baggage: 40 }, 110, 70);
    expect(result.takeoff.massKg).toBeCloseTo(1009.2, 6);
    expect(result.takeoff.cgM).toBeCloseTo(0.6068, 4);
    expect(result.status).toBe('BLOCKING');
    expect(result.messages.map((m) => m.key)).toEqual(
      expect.arrayContaining(['navplan.mb.aboveMtow', 'navplan.mb.cgAft']),
    );
    expect(result.messages).toHaveLength(2);
  });

  it('3 front 120, 30 L: 701.6 kg, CG 0.3720', () => {
    const result = compute({ front: 120 }, 30);
    expect(result.takeoff.massKg).toBeCloseTo(701.6, 6);
    expect(result.takeoff.cgM).toBeCloseTo(0.372, 3);
    expect(result.status).toBe('OK');
  });

  it('4 baggage 70 kg over its 60 kg limit', () => {
    const result = compute({ front: 80, baggage: 70 }, 30);
    expect(result.status).toBe('BLOCKING');
    expect(result.messages).toContainEqual({
      key: 'navplan.mb.stationLimit',
      params: { station: 'Bagages', mass: 70, max: 60 },
    });
  });

  it('5 a point exactly on an edge is inside, margin 0', () => {
    const state = stateOf(700, 0.564 * 700, data.envelopes[0], 1000);
    expect(state.withinEnvelope).toBe(true);
    expect(state.marginCgMm).toBeCloseTo(0, 6);
  });

  it('burns fuel by the declared order or proportionally', () => {
    expect(burnFuel({ a: 50, b: 50 }, 30, [])).toEqual({ a: 35, b: 35 });
    expect(burnFuel({ a: 20, b: 50 }, 30, ['a', 'b'])).toEqual({ a: 0, b: 40 });
  });
});
