import { gunzipSync, gzipSync } from 'zlib';
import {
  pressureAltitudeFt,
  pressureAltitudeOfHpa,
} from '../engine/atmosphere';
import { componentsToWind } from '../engine/wind-triangle';

// The compact winds/temperatures grid written by the ICON-EU job and read by
// the API: u, v (m/s) and T (K) on pressure levels over France and its
// neighbours, for the forecast steps of one model run. Values are int16
// with a scale per variable; layout [step][level][variable][lat][lon].

export const GRID_SCHEMA = 1;
export const WINDS_ATTRIBUTION =
  'Vents et températures : Deutscher Wetterdienst, modèle ICON-EU, données ouvertes CC BY 4.0 (https://www.dwd.de/copyright) / Winds and temperatures: Deutscher Wetterdienst, ICON-EU model, open data CC BY 4.0';
const MS_TO_KT = 3600 / 1852;

export const GRID_VARIABLES = ['u', 'v', 't'] as const;
const SCALE: Record<
  (typeof GRID_VARIABLES)[number],
  { scale: number; offset: number }
> = {
  u: { scale: 0.01, offset: 0 },
  v: { scale: 0.01, offset: 0 },
  t: { scale: 0.01, offset: 273.15 },
};

export interface GridHeader {
  schema: number;
  model: string;
  run: string; // ISO reference time
  steps: number[]; // forecast hours
  levels: number[]; // hPa, high pressure first
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  nLat: number;
  nLon: number;
  createdAt: string;
  attribution: string;
}

export interface WindsGrid {
  header: GridHeader;
  data: Int16Array;
}

export const encodeGrid = (grid: WindsGrid): Buffer => {
  const header = Buffer.from(JSON.stringify(grid.header));
  const length = Buffer.alloc(4);
  length.writeUInt32LE(header.length, 0);
  return gzipSync(
    Buffer.concat([
      length,
      header,
      Buffer.from(grid.data.buffer, grid.data.byteOffset, grid.data.byteLength),
    ]),
  );
};

export const decodeGrid = (compressed: Buffer): WindsGrid => {
  const buffer = gunzipSync(compressed);
  const length = buffer.readUInt32LE(0);
  const header = JSON.parse(
    buffer.subarray(4, 4 + length).toString('utf8'),
  ) as GridHeader;
  if (header.schema !== GRID_SCHEMA)
    throw new Error(`Grid schema ${header.schema}`);
  const bytes = buffer.subarray(4 + length);
  const data = new Int16Array(bytes.byteLength / 2);
  for (let i = 0; i < data.length; i++) data[i] = bytes.readInt16LE(i * 2);
  return { header, data };
};

export const quantize = (
  variable: (typeof GRID_VARIABLES)[number],
  value: number,
): number => {
  const { scale, offset } = SCALE[variable];
  return Math.max(
    -32768,
    Math.min(32767, Math.round((value - offset) / scale)),
  );
};

const index = (
  h: GridHeader,
  step: number,
  level: number,
  variable: number,
  lat: number,
  lon: number,
) =>
  (((step * h.levels.length + level) * GRID_VARIABLES.length + variable) *
    h.nLat +
    lat) *
    h.nLon +
  lon;

export interface GridSample {
  fromDeg: number;
  speedKt: number;
  temperatureC: number;
  validAt: Date;
}

// Wind and temperature at a point, an altitude AMSL on the QNH and a time:
// bilinear in latitude/longitude, linear in pressure altitude between the
// model levels (their ISA altitude), linear in time between steps. The
// wind is interpolated as u/v components, never as a direction. Null
// outside the grid, above the highest level or outside the forecast range.
export function sampleGrid(
  grid: WindsGrid,
  lat: number,
  lon: number,
  altitudeFt: number,
  qnhHpa: number,
  time: Date,
): GridSample | null {
  const h = grid.header;
  const y = (lat - h.lat0) / h.dLat;
  const x = (lon - h.lon0) / h.dLon;
  if (y < 0 || x < 0 || y > h.nLat - 1 || x > h.nLon - 1) return null;
  const run = new Date(h.run).getTime();
  const hours = (time.getTime() - run) / 3_600_000;
  if (hours < h.steps[0] || hours > h.steps[h.steps.length - 1]) return null;
  let s = 0;
  while (s < h.steps.length - 2 && hours > h.steps[s + 1]) s++;
  const st =
    h.steps.length === 1
      ? 0
      : (hours - h.steps[s]) / (h.steps[s + 1] - h.steps[s]);

  const zp = pressureAltitudeFt(altitudeFt, qnhHpa);
  const levelAltitudes = h.levels.map(pressureAltitudeOfHpa);
  if (zp > levelAltitudes[levelAltitudes.length - 1]) return null;
  // Below the lowest level (1000 hPa, about 360 ft) the lowest level is used.
  let l = 0;
  while (l < levelAltitudes.length - 2 && zp > levelAltitudes[l + 1]) l++;
  const lt = Math.max(
    0,
    Math.min(
      1,
      (zp - levelAltitudes[l]) / (levelAltitudes[l + 1] - levelAltitudes[l]),
    ),
  );

  const y0 = Math.min(Math.floor(y), h.nLat - 2);
  const x0 = Math.min(Math.floor(x), h.nLon - 2);
  const fy = y - y0;
  const fx = x - x0;

  const value = (variable: number) => {
    let total = 0;
    for (const [step, ws] of [
      [s, 1 - st],
      [Math.min(s + 1, h.steps.length - 1), st],
    ] as const) {
      if (ws === 0) continue;
      for (const [level, wl] of [
        [l, 1 - lt],
        [Math.min(l + 1, h.levels.length - 1), lt],
      ] as const) {
        if (wl === 0) continue;
        const v00 = grid.data[index(h, step, level, variable, y0, x0)];
        const v01 = grid.data[index(h, step, level, variable, y0, x0 + 1)];
        const v10 = grid.data[index(h, step, level, variable, y0 + 1, x0)];
        const v11 = grid.data[index(h, step, level, variable, y0 + 1, x0 + 1)];
        const bilinear =
          v00 * (1 - fx) * (1 - fy) +
          v01 * fx * (1 - fy) +
          v10 * (1 - fx) * fy +
          v11 * fx * fy;
        total += ws * wl * bilinear;
      }
    }
    const name = GRID_VARIABLES[variable];
    return total * SCALE[name].scale + SCALE[name].offset;
  };
  const u = value(0) * MS_TO_KT;
  const v = value(1) * MS_TO_KT;
  const wind = componentsToWind(u, v);
  return {
    fromDeg: wind.fromDeg,
    speedKt: wind.speedKt,
    temperatureC: value(2) - 273.15,
    validAt: new Date(run + Math.round(hours) * 3_600_000),
  };
}
