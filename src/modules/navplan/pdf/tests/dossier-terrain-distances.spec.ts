import { computeFlightPlan } from '../../engine/engine';
import { aerodromeDistances } from '../../engine/runway-distances';
import { TerrainGrid } from '../../engine/terrain';
import { engineInput } from '../../engine/tests/fixture';
import {
  aerodromeLines,
  buildDossierPdf,
  distanceHeading,
  distanceRows,
  msaCell,
} from '../dossier.pdf';

const flat: TerrainGrid = {
  south: 46,
  west: -3,
  north: 49,
  east: 0,
  cellDeg: 1 / 120,
  rows: 360,
  cols: 360,
  data: new Int16Array(360 * 360).fill(400),
  noData: -32768,
};

describe('flight dossier: minimum safe altitude and distances', () => {
  it('prints the MSA of each leg, "?" when unknown', () => {
    const known = computeFlightPlan(engineInput({ terrain: flat }));
    expect(msaCell(known.legs[0])).toBe('1400');
    const unknown = computeFlightPlan(engineInput({ terrain: null }));
    expect(msaCell(unknown.legs[0])).toBe('?');
    expect(msaCell({ ...known.legs[0], terrain: undefined })).toBe('');
  });

  it('lists the runways with the factors and what is needed and available', () => {
    const distances = aerodromeDistances({
      kind: 'TAKEOFF',
      runways: [
        {
          designator: '09/27',
          trueHeadingDeg: 90,
          lengthM: 700,
          widthM: 20,
          surface: 'gazon',
          ends: ['09', '27'].map((designator, i) => ({
            designator,
            trueBearingDeg: 90 + i * 180,
            magneticBearingDeg: null,
            toraM: 700,
            todaM: 700,
            asdaM: 700,
            ldaM: 700,
            thresholdElevationFt: null,
            displacedThreshold: false,
            remarks: null,
          })),
        },
      ],
      elevationFt: 100,
      pressureAltitudeOf: (e) => e,
      temperatureC: 15,
      conditionsSource: 'METAR',
      massKg: 1000,
      massSource: 'MASS_BALANCE',
      winds: [],
      wet: false,
      table: {
        referenceMassKg: 1000,
        rows: [
          {
            pressureAltFt: 0,
            temperatureC: 0,
            groundRollM: 200,
            distance15mM: 400,
          },
        ],
      },
      safetyFactor: 1.33,
    });
    const rows = distanceRows(distances, 'fr');
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe('* 09');
    expect(rows[0][3]).toContain('Herbe sèche x1.2 (CAA)');
    expect(rows[0][4]).toBe(
      `${Math.ceil(200 * 1.2 * 1.33)} / ${Math.ceil(400 * 1.2 * 1.33)} m`,
    );
    expect(rows[0][5]).toBe('700 / 700 m');
    expect(distanceHeading(distances, 'fr')[0]).toContain('masse 1000 kg');
  });

  it('leaves out an aerodrome type of OurAirports, not a SIA status', () => {
    const lines = aerodromeLines(
      {
        role: 'departure',
        icao: 'LFLS',
        conditions: null,
        sheet: {
          icao: 'LFLS',
          name: 'Grenoble',
          elevationFt: 1302,
          source: 'OURAIRPORTS',
          status: 'medium_airport',
          vfr: null,
          ifr: null,
          privateFlights: null,
          magneticVariationDeg: null,
          magneticVariationYear: null,
          atsHoursCode: null,
          atsHours: null,
          fuelHours: null,
          fuel: null,
          fuelRemarks: null,
          fuelTypes: [],
          remarks: null,
          phone: null,
          operator: null,
          runways: [],
          frequencies: [],
          vacUrl: null,
          chartsUrl: 'https://www.sia.aviation-civile.gouv.fr',
        },
      },
      'fr',
    );
    expect(lines.map((l) => l.text).join(' ')).not.toContain('medium_airport');
  });

  it('builds the dossier with both', async () => {
    const result = computeFlightPlan(engineInput({ terrain: flat }));
    const pdf = await buildDossierPdf({
      result,
      format: 'A4',
      language: 'fr',
      pilot: 'Test',
      aircraft: 'F-TEST',
      weighingDate: null,
    });
    expect(Buffer.from(pdf, 'base64').subarray(0, 4).toString()).toBe('%PDF');
  });
});
