import { emptyAirspacesKey, labelBelow } from '../dossier.pdf';

describe('flight dossier PDF', () => {
  it('says the airspaces were not checked, never "none crossed", without airspace data', () => {
    expect(emptyAirspacesKey([{ code: 'NAVDATA_NO_AIRSPACE' }])).toBe(
      'navplan.pdf.airspaces.notChecked',
    );
    expect(emptyAirspacesKey([{ code: 'DISCLAIMER' }])).toBe(
      'navplan.pdf.airspaces.none',
    );
  });

  it('puts the landing label under its point when the take-off one is close', () => {
    expect(labelBelow([[100, 100]], [102, 101])).toBe(true);
    expect(labelBelow([[100, 100]], [200, 100])).toBe(false);
    expect(labelBelow([], [100, 100])).toBe(false);
  });
});
