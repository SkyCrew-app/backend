import { Taxonomies, TaxonomiesInput } from '../types/taxonomies';

describe('Taxonomies types', () => {
  it('Taxonomies instanciation', () => {
    const t = new Taxonomies();
    t.maintenanceTypes = ['a'];
    t.licenseTypes = ['b'];
    t.aircraftCategories = ['c'];
    t.flightTypes = ['d'];
    expect(t).toMatchObject({
      maintenanceTypes: ['a'],
      licenseTypes: ['b'],
      aircraftCategories: ['c'],
      flightTypes: ['d'],
    });
  });

  it('TaxonomiesInput instanciation', () => {
    const ti = new TaxonomiesInput();
    ti.maintenanceTypes = ['x'];
    ti.licenseTypes = ['y'];
    ti.aircraftCategories = ['z'];
    ti.flightTypes = ['w'];
    expect(ti).toMatchObject({
      maintenanceTypes: ['x'],
      licenseTypes: ['y'],
      aircraftCategories: ['z'],
      flightTypes: ['w'],
    });
  });
});
