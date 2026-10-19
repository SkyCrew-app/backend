// The freezing level (0 °C isotherm) from the temperatures of the winds
// aloft forecast (ICON-EU, 1000 to 600 hPa, up to about 13 800 ft): the
// lowest altitude where the temperature reaches 0 °C, scanning up from the
// ground every 100 ft and interpolating between two samples. SURFACE: 0 °C
// or less at the ground; ABOVE: still positive at the top of the forecast
// (topFt); UNKNOWN: no forecast there or then.

export type FreezingState = 'LEVEL' | 'SURFACE' | 'ABOVE' | 'UNKNOWN';

export interface FreezingLevel {
  place: 'DEPARTURE' | 'ROUTE' | 'DESTINATION';
  ident: string | null;
  at: Date;
  altitudeFt: number | null;
  state: FreezingState;
  topFt: number | null;
}

const STEP_FT = 100;
const MAX_FT = 20_000;

export function freezingLevelAt(
  temperatureAt: (altitudeFt: number) => number | null,
  groundFt: number,
): { altitudeFt: number | null; state: FreezingState; topFt: number | null } {
  const start = Math.max(0, groundFt);
  let previous = temperatureAt(start);
  if (previous === null)
    return { altitudeFt: null, state: 'UNKNOWN', topFt: null };
  if (previous <= 0)
    return { altitudeFt: start, state: 'SURFACE', topFt: null };
  let top = start;
  for (
    let altitude = start + STEP_FT;
    altitude <= MAX_FT;
    altitude += STEP_FT
  ) {
    const temperature = temperatureAt(altitude);
    if (temperature === null) break;
    if (temperature <= 0) {
      const fraction = previous / (previous - temperature);
      return {
        altitudeFt:
          Math.round((altitude - STEP_FT + fraction * STEP_FT) / 100) * 100,
        state: 'LEVEL',
        topFt: null,
      };
    }
    previous = temperature;
    top = altitude;
  }
  return { altitudeFt: null, state: 'ABOVE', topFt: top };
}
