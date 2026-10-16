import { BadRequestException } from '@nestjs/common';
import {
  AIRCRAFT_TEMPLATES,
  templateForModel,
  TEMPLATE_WARNING,
} from '../aircraft-templates';
import {
  AircraftDataService,
  fleetPerformance,
} from '../aircraft-data.service';
import { isSimplePolygon } from '../../../navplan/engine/polygon';
import { cruiseAt } from '../../../navplan/engine/performance';
import { stateOf } from '../../../navplan/engine/mass-balance';
import { AircraftTemplate } from '../aircraft-templates';

const repository = (key: string, rows: Record<string, any>[] = []) => ({
  findOne: async ({ where }: any) =>
    rows.find((row) => Object.entries(where).every(([k, v]) => row[k] === v)) ??
    null,
  save: async (value: any) => {
    const existing = rows.find((row) => row[key] === value[key]);
    if (existing) return Object.assign(existing, value);
    rows.push(value);
    return value;
  },
  update: async (where: any, values: any) => {
    rows
      .filter((row) => row[key] === where[key])
      .forEach((row) => Object.assign(row, values));
  },
  rows,
});

describe('aircraft type templates', () => {
  it('cover the types the owner asked for', () => {
    expect(AIRCRAFT_TEMPLATES.map((t) => t.code).sort()).toEqual(
      [
        'C172S',
        'DA40',
        'DR400-120',
        'DR400-140B',
        'DR400-160',
        'DR400-180',
        'P2008JC',
        'PA28-161',
        'TB10',
      ].sort(),
    );
  });

  it.each(AIRCRAFT_TEMPLATES.map((t) => [t.code, t]))(
    '%s: marked "to check", simple envelope within the MTOW, tanks consistent',
    (_code, template: any) => {
      expect(template.source.startsWith(TEMPLATE_WARNING)).toBe(true);
      for (const envelope of template.massBalance.envelopes) {
        expect(
          isSimplePolygon(envelope.points.map((p: any) => [p.armM, p.massKg])),
        ).toBe(true);
        expect(
          Math.max(...envelope.points.map((p: any) => p.massKg)),
        ).toBeLessThanOrEqual(template.massBalance.mtowKg);
      }
      const tanks = template.performance.fuel.tanks.map((t: any) => t.id);
      for (const station of template.massBalance.stations.filter(
        (s: any) => s.kind === 'FUEL',
      )) {
        expect(tanks).toContain(station.tankId);
      }
      if (template.performance.cruise.rows.length > 0) {
        expect(() =>
          cruiseAt(
            template.performance.cruise,
            template.performance.cruise.normalSetting,
            0,
            0,
          ),
        ).not.toThrow();
      }
    },
  );

  const template = (code: string) =>
    AIRCRAFT_TEMPLATES.find((t) => t.code === code) as AircraftTemplate;
  const robinEnvelope = (max: number) => [
    { armM: 0.205, massKg: 500 },
    { armM: 0.205, massKg: 750 },
    { armM: 0.428, massKg: max },
    { armM: 0.564, massKg: max },
    { armM: 0.564, massKg: 500 },
  ];

  it('DR400-180: the Robin flight manual figures, never a wider envelope', () => {
    const dr400 = template('DR400-180');
    const mb = dr400.massBalance;
    // Manual p. 2.2 (and TCDS EASA.A.367 section Z).
    expect(mb.mtowKg).toBe(1100);
    expect(mb.mlwKg).toBe(1045);
    expect(mb.envelopes).toEqual([
      { category: 'NORMAL', points: robinEnvelope(1100) },
      { category: 'UTILITY', points: robinEnvelope(950) },
    ]);
    const normal = mb.envelopes[0];
    // The report's case: at 900 kg the manual's forward limit is 0.301 m.
    expect(stateOf(900, 900 * 0.261, normal, 1100).withinEnvelope).toBe(false);
    expect(stateOf(900, 900 * 0.305, normal, 1100).withinEnvelope).toBe(true);
    // Manual p. 4.1 bis example: 1056 kg at 0.525 m is within the limits.
    expect(stateOf(1056, 554.03, normal, 1100).withinEnvelope).toBe(true);
    // p. 2.3 baggage, p. 4.1 arms, p. 1.6 / 2.5 tanks.
    expect(mb.stations.filter((s) => s.kind !== 'FUEL')).toEqual([
      expect.objectContaining({ id: 'front', armM: 0.41 }),
      expect.objectContaining({ id: 'rear', armM: 1.19 }),
      expect.objectContaining({ id: 'baggage', armM: 1.9, maxKg: 60 }),
    ]);
    expect(
      dr400.performance.fuel.tanks.map((t) => [t.usableL, t.armM]),
    ).toEqual([
      [100, 1.12],
      [40, 0.1],
      [40, 0.1],
    ]);
    // p. 5.3: 75 % = 248 km/h (133.9 kt), 39 L/h at sea level.
    expect(cruiseAt(dr400.performance.cruise, '75%', 0, 0)).toMatchObject({
      tasKt: 133.9,
      fuelFlowLph: 39,
    });
    // Not in the manual: left empty for the administrator.
    expect(dr400.performance.climb.fuelFlowLph).toBeNull();
    expect(dr400.performance.descent.fuelFlowLph).toBe(0);
    expect(dr400.performance.reserve.maxContinuousFuelFlowLph).toBe(0);
  });

  it('DR400-120, 140B and 160: masses and envelopes of the EASA TCDS, unsourced figures left empty', () => {
    for (const [code, mtow, mlw, utility] of [
      ['DR400-120', 900, 900, 900],
      ['DR400-140B', 1000, 1000, 910],
      ['DR400-160', 1050, 1045, 950],
    ] as const) {
      const robin = template(code);
      expect(robin.massBalance).toMatchObject({ mtowKg: mtow, mlwKg: mlw });
      expect(robin.massBalance.envelopes).toEqual([
        { category: 'NORMAL', points: robinEnvelope(mtow) },
        { category: 'UTILITY', points: robinEnvelope(utility) },
      ]);
      expect(
        robin.massBalance.stations.find((s) => s.id === 'baggage')?.maxKg,
      ).toBe(40);
      expect(robin.performance.cruise.rows).toEqual([]);
      expect(robin.performance.reserve.holdingFuelFlowLph).toBe(0);
    }
    // No arm read for the main tank of the 120 and 140B: no tank at all.
    expect(template('DR400-140B').performance.fuel.tanks).toEqual([]);
    expect(template('DR400-160').performance.fuel.tanks).toHaveLength(3);
  });

  it('TB10 and P2008: no figure without a source', () => {
    for (const code of ['TB10', 'P2008JC']) {
      const empty = template(code);
      expect(empty.massBalance).toMatchObject({
        mtowKg: null,
        mlwKg: null,
        stations: [],
        envelopes: [],
      });
      expect(empty.performance.fuel.tanks).toEqual([]);
      expect(empty.performance.cruise.rows).toEqual([]);
    }
  });

  it('matches the fleet models', () => {
    expect(templateForModel('Robin DR400-140B')?.code).toBe('DR400-140B');
    expect(templateForModel('Cessna 172 Skyhawk')?.code).toBe('C172S');
    expect(templateForModel('Diamond DA40 NG')).toBeNull();
    expect(templateForModel('Cirrus SR22')).toBeNull();
  });

  it('derives fleet-sheet performance in knots and litres per hour', () => {
    const performance = fleetPerformance({
      cruiseSpeed: 115,
      consumption: 28,
      fuel_capacity: 110,
      fuel_type: '100LL',
    } as any);
    expect(cruiseAt(performance.cruise, 'fleet', 3000, 0)).toEqual({
      tasKt: 115,
      fuelFlowLph: 28,
      temperatureIgnored: false,
    });
    expect(performance.fuel.tanks[0].usableL).toBe(110);
  });
});

describe('aircraft data rules', () => {
  const service = () => {
    const performance = repository('aircraft_id');
    const massBalance = repository('aircraft_id');
    return {
      performance,
      massBalance,
      service: new AircraftDataService(
        repository('id', [{ id: 1, model: 'Robin DR400-140B' }]) as any,
        performance as any,
        massBalance as any,
      ),
    };
  };

  it('a template is applied unconfirmed and keeps the weighing of the aircraft', async () => {
    const { service: s, massBalance } = service();
    massBalance.rows.push({
      aircraft_id: 1,
      empty_mass_kg: 600,
      empty_arm_m: 0.35,
      weighing_date: new Date('2026-01-01'),
    });
    const result = await s.applyTemplate(1, 'DR400-140B');
    expect(result.validatedAt).toBeNull();
    expect(massBalance.rows[0]).toMatchObject({
      empty_mass_kg: 600,
      empty_arm_m: 0.35,
      mtow_kg: 1000,
      validated_at: null,
    });
    await expect(s.applyTemplate(1, 'B747')).rejects.toThrow(
      'Modèle inconnu : B747',
    );
  });

  // What the administrator adds to the DR400-180 template from the manual
  // of the aircraft and its weighing.
  const complete = (performance: any, massBalance: any) => {
    Object.assign(massBalance.rows[0], {
      empty_mass_kg: 600,
      empty_arm_m: 0.35,
      weighing_date: new Date('2026-01-01'),
    });
    const row = performance.rows[0];
    row.climb = { ...row.climb, fuelFlowLph: 50 };
    row.descent = { iasKt: 100, rateFpm: 500, fuelFlowLph: 25 };
    row.reserve = { ...row.reserve, maxContinuousFuelFlowLph: 50 };
  };

  it('refuses to confirm data without a weighing, confirms it once complete', async () => {
    const { service: s, massBalance, performance } = service();
    await s.applyTemplate(1, 'DR400-180');
    await expect(s.validate(1, { id: 9, email: 'a' })).rejects.toThrow(
      BadRequestException,
    );
    complete(performance, massBalance);
    expect(await s.validate(1, { id: 9, email: 'a' })).toBe(true);
    expect(performance.rows[0]).toMatchObject({ validated_by_id: 9 });
    expect(massBalance.rows[0].validated_at).toBeInstanceOf(Date);
  });

  it('refuses to confirm a template whose unsourced figures were not entered', async () => {
    for (const [code, gaps] of [
      ['DR400-180', ['climb', 'descent', 'reserve fuel flows']],
      [
        'DR400-140B',
        ['performance', 'fuel tanks', 'climb', 'descent', 'reserve fuel flows'],
      ],
      ['TB10', ['performance', 'MTOW', 'MLW', 'seats', 'envelope']],
      ['P2008JC', ['performance', 'MTOW', 'MLW', 'seats', 'envelope']],
    ] as const) {
      const { service: s, massBalance } = service();
      await s.applyTemplate(1, code);
      Object.assign(massBalance.rows[0], {
        empty_mass_kg: 600,
        empty_arm_m: 0.35,
        weighing_date: new Date('2026-01-01'),
      });
      const refusal = await s
        .validate(1, { id: 9, email: 'a' })
        .catch((error) => error);
      expect(refusal).toBeInstanceOf(BadRequestException);
      for (const gap of gaps) expect(refusal.message).toContain(gap);
    }
  });

  it('a new save clears the confirmation', async () => {
    const { service: s, massBalance, performance } = service();
    await s.applyTemplate(1, 'DR400-180');
    complete(performance, massBalance);
    await s.validate(1, { id: 9, email: 'a' });
    const template = AIRCRAFT_TEMPLATES.find((t) => t.code === 'DR400-180');
    await s.saveMassBalance(1, {
      emptyMassKg: 601,
      emptyArmM: 0.35,
      weighingDate: new Date('2026-02-01'),
      mtowKg: 1100,
      mlwKg: 1045,
      stations: template.massBalance.stations as any,
      combinedLimits: [],
      envelopes: template.massBalance.envelopes as any,
    });
    expect(massBalance.rows[0].validated_at).toBeNull();
  });

  it('refuses inconsistent performance data', () => {
    const { service: s } = service();
    const base = AIRCRAFT_TEMPLATES.find(
      (t) => t.code === 'DR400-180',
    ).performance;
    const template = { ...base, climb: { ...base.climb, fuelFlowLph: 50 } };
    const input = (changes: any) =>
      ({ ...template, source: null, ...changes }) as any;
    expect(() =>
      s.checkPerformance(
        input({ cruise: { normalSetting: '55%', rows: template.cruise.rows } }),
      ),
    ).toThrow(/normal setting/);
    expect(() =>
      s.checkPerformance(
        input({
          climb: {
            iasKt: 76,
            table: [
              { pressureAltFt: 0, timeMin: 0, fuelL: 0, distanceNm: 0 },
              { pressureAltFt: 2000, timeMin: 3, fuelL: 1, distanceNm: 4 },
              { pressureAltFt: 4000, timeMin: 2, fuelL: 2, distanceNm: 8 },
            ],
          },
        }),
      ),
    ).toThrow(/grow with altitude/);
    expect(() =>
      s.checkPerformance(
        input({ fuel: { ...template.fuel, burnOrder: ['aux'] } }),
      ),
    ).toThrow(/burnOrder/);
    expect(() => s.checkPerformance(input({}))).not.toThrow();
  });

  it('refuses inconsistent mass and balance data', () => {
    const { service: s } = service();
    const base = {
      emptyMassKg: 600,
      emptyArmM: 0.35,
      weighingDate: new Date(),
      mtowKg: 1000,
      mlwKg: 1000,
      stations: [{ id: 'front', label: 'AV', kind: 'SEAT', armM: 0.41 }],
      combinedLimits: [],
      envelopes: [
        {
          category: 'NORMAL',
          points: [
            { armM: 0.2, massKg: 500 },
            { armM: 0.2, massKg: 1000 },
            { armM: 0.56, massKg: 1000 },
            { armM: 0.56, massKg: 500 },
          ],
        },
      ],
    } as any;
    expect(() => s.checkMassBalance(base, null)).not.toThrow();
    expect(() => s.checkMassBalance({ ...base, mlwKg: 1100 }, null)).toThrow(
      /MLW above MTOW/,
    );
    expect(() =>
      s.checkMassBalance(
        {
          ...base,
          combinedLimits: [{ stationIds: ['rear'], maxKg: 50, label: 'X' }],
        },
        null,
      ),
    ).toThrow(/unknown station/);
    expect(() => s.checkMassBalance({ ...base, envelopes: [] }, null)).toThrow(
      /no envelope/,
    );
    expect(() =>
      s.checkMassBalance(
        {
          ...base,
          stations: [
            { id: 'f', label: 'Fuel', kind: 'FUEL', armM: 1, tankId: 'aux' },
          ],
        },
        ['main'],
      ),
    ).toThrow(/unknown tank/);
  });
});
