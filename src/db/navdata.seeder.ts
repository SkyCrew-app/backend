import type { NavdataImportService } from '../modules/navdata/import/navdata-import.service';
import type { NavdataService } from '../modules/navdata/navdata.service';

// The API imports the baseline aerodromes when it starts, but a fresh seed
// empties every table afterwards: import them again before anything (the
// demo flights) needs an aerodrome.
export const seedNavdataBaseline = async (
  importService: Pick<NavdataImportService, 'ensureData'>,
  navdata: Pick<NavdataService, 'invalidate' | 'activeCycle'>,
): Promise<void> => {
  navdata.invalidate();
  await importService.ensureData();
  navdata.invalidate();
  if (!(await navdata.activeCycle())) {
    throw new Error(
      'No navigation data: the baseline bundle could not be imported',
    );
  }
};
