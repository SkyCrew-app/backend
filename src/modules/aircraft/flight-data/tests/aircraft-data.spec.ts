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
    '%s: marked "to check", simple envelope, cruise table from 0 ft, tanks consistent',
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
      expect(() =>
        cruiseAt(
          template.performance.cruise,
          template.performance.cruise.normalSetting,
          0,
          0,
        ),
      ).not.toThrow();
      expect(() =>
        cruiseAt(
          template.performance.cruise,
          template.performance.cruise.normalSetting,
          9500,
          0,
        ),
      ).not.toThrow();
    },
  );

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

  it('refuses to confirm data without a weighing, confirms it once complete', async () => {
    const { service: s, massBalance, performance } = service();
    await s.applyTemplate(1, 'DR400-140B');
    await expect(s.validate(1, { id: 9, email: 'a' })).rejects.toThrow(
      BadRequestException,
    );
    Object.assign(massBalance.rows[0], {
      empty_mass_kg: 600,
      empty_arm_m: 0.35,
      weighing_date: new Date('2026-01-01'),
    });
    expect(await s.validate(1, { id: 9, email: 'a' })).toBe(true);
    expect(performance.rows[0]).toMatchObject({ validated_by_id: 9 });
    expect(massBalance.rows[0].validated_at).toBeInstanceOf(Date);
  });

  it('a new save clears the confirmation', async () => {
    const { service: s, massBalance } = service();
    await s.applyTemplate(1, 'DR400-140B');
    Object.assign(massBalance.rows[0], {
      empty_mass_kg: 600,
      empty_arm_m: 0.35,
      weighing_date: new Date('2026-01-01'),
    });
    await s.validate(1, { id: 9, email: 'a' });
    const template = AIRCRAFT_TEMPLATES.find((t) => t.code === 'DR400-140B');
    await s.saveMassBalance(1, {
      emptyMassKg: 601,
      emptyArmM: 0.35,
      weighingDate: new Date('2026-02-01'),
      mtowKg: 1000,
      mlwKg: 1000,
      stations: template.massBalance.stations as any,
      combinedLimits: [],
      envelopes: template.massBalance.envelopes as any,
    });
    expect(massBalance.rows[0].validated_at).toBeNull();
  });

  it('refuses inconsistent performance data', () => {
    const { service: s } = service();
    const template = AIRCRAFT_TEMPLATES.find(
      (t) => t.code === 'DR400-140B',
    ).performance;
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
