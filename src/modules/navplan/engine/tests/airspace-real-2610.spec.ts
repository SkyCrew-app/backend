import {
  AirspaceCrossing,
  isAirbandVhf,
  legCrossings,
  requirementOf,
} from '../airspace-intersection';
import { inverse, LatLon } from '../geodesy';
import { AirspaceEntity } from '../../../navdata/entity/navdata.entity';
import { toAirspaceRecord } from '../../../navdata/navdata.service';
import { AERODROMES_2610, PARIS_2610 } from './fixtures/sia-2610-paris';

// Routes of the first production import (AIRAC 2610) on its real outlines,
// at a constant altitude; the entries and exits were checked by an
// independent dense sampling of the same outlines (ray casting every
// 0.02 NM along the geodesic).
const leg = (from: LatLon, to: LatLon, altitudeFt: number) => ({
  from,
  to,
  distanceNm: inverse(from, to).distanceNm,
  altitudeAt: () => altitudeFt,
});
const byName = (crossings: AirspaceCrossing[], name: string) =>
  crossings.find((c) => c.airspace.name === name)!;
const { LFPN, LFPO, LFOP } = AERODROMES_2610;
const PARIS_CENTRE = { lat: 48.86, lon: 2.34 };

describe('crossings on the real airspaces of AIRAC 2610 (Paris)', () => {
  it('LFPN → LFOP at 2000 ft: inside the class A TMA PARIS 2 from 0 to 6.6 NM, BLOCKING', () => {
    const crossings = legCrossings(
      leg(LFPN, LFOP, 2000),
      PARIS_2610,
      1013.25,
      300,
    );
    const tma2 = byName(crossings, 'TMA PARIS 2');
    expect(tma2.relation).toBe('INSIDE');
    expect(tma2.status).toBe('BLOCKING');
    expect(tma2.requirement.key).toBe('navplan.airspace.classA');
    expect(tma2.entryNm).toBeCloseTo(0, 1);
    expect(Math.abs(tma2.exitNm - 6.6)).toBeLessThan(0.1);
    // R 205 /2 (aerodrome procedures): a warning that asks to check the day's activity.
    const r205 = byName(crossings, 'R 205 /2 PARIS 2');
    expect(r205.status).toBe('WARNING');
    expect(r205.requirement).toEqual({
      key: 'navplan.airspace.restricted',
      params: { activity: "Procédures d'aérodromes · Aerodrome procedures" },
    });
  });

  it('LFPN → LFOP at 2500 ft: at the ceiling of TMA PARIS 2 and the floor of TMA PARIS 3 (to 21.1 NM), both BLOCKING', () => {
    const crossings = legCrossings(
      leg(LFPN, LFOP, 2500),
      PARIS_2610,
      1013.25,
      300,
    );
    expect(byName(crossings, 'TMA PARIS 2').relation).toBe('NEAR_CEILING');
    expect(byName(crossings, 'TMA PARIS 2').status).toBe('BLOCKING');
    const tma3 = byName(crossings, 'TMA PARIS 3');
    expect(tma3.relation).toBe('NEAR_FLOOR');
    expect(tma3.status).toBe('BLOCKING');
    expect(Math.abs(tma3.exitNm - 21.1)).toBeLessThan(0.1);
  });

  it('LFPN → LFOP at 1000 ft: under the TMA PARIS 2 and 3, listed as passed under, OK', () => {
    const crossings = legCrossings(
      leg(LFPN, LFOP, 1000),
      PARIS_2610,
      1013.25,
      300,
    );
    for (const name of ['TMA PARIS 2', 'TMA PARIS 3']) {
      expect(byName(crossings, name).relation).toBe('BELOW');
      expect(byName(crossings, name).status).toBe('OK');
    }
  });

  it('LFPN → Paris centre at 2000 ft: inside P 23 PARIS from 8.4 NM, BLOCKING; above it at 7000 ft', () => {
    const low = byName(
      legCrossings(leg(LFPN, PARIS_CENTRE, 2000), PARIS_2610, 1013.25, 300),
      'P 23 PARIS',
    );
    expect(low.relation).toBe('INSIDE');
    expect(low.status).toBe('BLOCKING');
    expect(low.requirement.key).toBe('navplan.airspace.prohibited');
    expect(Math.abs(low.entryNm - 8.4)).toBeLessThan(0.1);
    const high = byName(
      legCrossings(leg(LFPN, PARIS_CENTRE, 7000), PARIS_2610, 1013.25, 300),
      'P 23 PARIS',
    );
    expect(high.relation).toBe('ABOVE');
    expect(high.status).toBe('OK');
  });

  it('LFPN → LFPO at 1500 ft: in the class D CTR PARIS, clearance from ORLY Approche 124.455', () => {
    const ctr = byName(
      legCrossings(leg(LFPN, LFPO, 1500), PARIS_2610, 1013.25, 300),
      'CTR PARIS',
    );
    expect(ctr.relation).toBe('INSIDE');
    expect(ctr.status).toBe('WARNING');
    expect(ctr.airspace.icaoClass).toBe('D');
    expect(ctr.requirement).toEqual({
      key: 'navplan.airspace.clearance',
      params: { radio: 'ORLY Approche 124.455' },
    });
    expect(Math.abs(ctr.entryNm - 1.7)).toBeLessThan(0.1);
  });

  it('names a VHF frequency of the air band rather than a military UHF one or the emergency one (TMA EVREUX)', () => {
    expect(isAirbandVhf('362.300')).toBe(false);
    expect(isAirbandVhf('118.805')).toBe(true);
    expect(isAirbandVhf('121.500')).toBe(false);
    const tma = {
      ...PARIS_2610[1],
      icaoClass: 'D',
      // The frequencies of the service APP EVREUX, in the order of the export.
      frequencies: [
        '362.300',
        '243.000',
        '362.200',
        '121.500',
        '118.125',
        '142.450',
      ].map((mhz) => ({ service: 'APP', callsign: 'EVREUX Approche', mhz })),
    };
    expect(requirementOf(tma, 'INSIDE').requirement).toEqual({
      key: 'navplan.airspace.clearance',
      params: { radio: 'EVREUX Approche 118.125' },
    });
  });

  it('a cycle imported before the cleaning: its activity and remarks lose the "#" and "\\\\" when read', () => {
    const record = toAirspaceRecord({
      id: 'r205-2',
      name: 'R 205 /2 PARIS 2',
      type: 'R',
      icao_class: null,
      floor_ref: 'AMSL',
      floor_value: 1500,
      ceiling_ref: 'AMSL',
      ceiling_value: 2500,
      activity: "Procédures d'aérodromes#\\\\Aerodrome procedures",
      schedule_code: 'H24',
      frequencies: [],
      remarks: 'Pénétration interdite.\n\\\\Entry prohibited.',
      geometry: PARIS_2610[4].geometry,
      min_lat: 48.6,
      max_lat: 48.8,
      min_lon: 2,
      max_lon: 2.2,
    } as unknown as AirspaceEntity);
    expect(record.activity).toBe(
      "Procédures d'aérodromes\nAerodrome procedures",
    );
    expect(record.remarks).toBe('Pénétration interdite.\nEntry prohibited.');
  });
});
