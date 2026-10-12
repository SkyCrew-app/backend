import {
  buildFlightRecapPdf,
  flightRecapLines,
  formatHours,
  wrapText,
} from '../flight-recap-pdf';

const flight = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 6,
    origin_icao: 'LFPO',
    destination_icao: 'LFPN',
    flight_type: 'local',
    flight_hours: 1.5,
    distance_km: 18.7023198776617,
    number_of_passengers: 1,
    weather_conditions: null,
    remarks: 'Vent de travers à l’atterrissage',
    closed_at: new Date('2026-10-11T08:00:00Z'),
    user: { first_name: 'Jean', last_name: 'Dupont' },
    reservation: {
      aircraft: { registration_number: 'F-GSKY', model: 'Cessna 172' },
    },
    ...overrides,
  }) as any;

describe('flight recap', () => {
  it('formats hours as hours and minutes', () => {
    expect(formatHours(1.5)).toBe('1 h 30');
    expect(formatHours(0.18833)).toBe('11 min');
    expect(formatHours(2)).toBe('2 h');
    expect(formatHours(null)).toBeNull();
  });

  it('lists what is known about the flight and leaves out what is empty', () => {
    const lines = Object.fromEntries(flightRecapLines(flight()));

    expect(lines).toMatchObject({
      Pilote: 'Jean Dupont',
      Aéronef: 'F-GSKY (Cessna 172)',
      Trajet: 'LFPO -> LFPN',
      'Heures de vol': '1 h 30',
      Distance: '18.7 km',
      Passagers: '1',
      Remarques: 'Vent de travers à l’atterrissage',
    });
    expect(lines).not.toHaveProperty('Météo');
    expect(lines).not.toHaveProperty('Départ');
    expect(lines['Clôturé le']).toContain('2026');
  });

  it('copes with a flight without reservation', () => {
    const lines = Object.fromEntries(
      flightRecapLines(flight({ reservation: null })),
    );

    expect(lines).not.toHaveProperty('Aéronef');
  });

  it('wraps a long text', () => {
    expect(wrapText('un deux trois quatre', 9)).toEqual([
      'un deux',
      'trois',
      'quatre',
    ]);
    expect(wrapText('', 10)).toEqual([]);
  });

  it('produces a PDF, even with characters the standard fonts lack', async () => {
    const base64 = await buildFlightRecapPdf(
      flight({ remarks: 'Trajet LFPO → LFPN ✈ sans incident' }),
    );

    expect(Buffer.from(base64, 'base64').subarray(0, 5).toString()).toBe(
      '%PDF-',
    );
  });
});
