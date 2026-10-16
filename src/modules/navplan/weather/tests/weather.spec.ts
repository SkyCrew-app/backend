import { aecDecode, AEC_DATA_MSB, AEC_DATA_PREPROCESS } from '../icon-eu/aec';
import {
  decodeGrid,
  encodeGrid,
  GRID_SCHEMA,
  GRID_VARIABLES,
  quantize,
  sampleGrid,
  WindsGrid,
} from '../winds-grid';
import { pressureAltitudeOfHpa } from '../../engine/atmosphere';

// A CCSDS 121.0-B coder written from the standard, only to build test
// streams: preprocessing (unit delay + mapping) and the four coding options.
class BitWriter {
  bits: number[] = [];
  write(value: number, count: number) {
    for (let i = count - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  fs(value: number) {
    for (let i = 0; i < value; i++) this.bits.push(0);
    this.bits.push(1);
  }
  bytes() {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => {
      if (bit) out[i >> 3] |= 0x80 >> (i & 7);
    });
    return out;
  }
}

const map = (x: number, predicted: number, xmin: number, xmax: number) => {
  const delta = x - predicted;
  const theta = Math.min(predicted - xmin, xmax - predicted);
  if (delta >= 0 && delta <= theta) return 2 * delta;
  if (delta < 0 && -delta <= theta) return 2 * -delta - 1;
  return theta + Math.abs(delta);
};

describe('CCSDS / AEC decoder (GRIB2 template 5.42)', () => {
  const n = 8;
  const J = 8;
  const params = {
    bitsPerSample: n,
    blockSize: J,
    rsi: 2,
    flags: AEC_DATA_PREPROCESS | AEC_DATA_MSB,
  };

  it('decodes split, uncompressed, zero-block and second-extension blocks', () => {
    // RSI 1: a smooth series then a jumpy one; RSI 2: flat then small steps.
    const rsi1 = [
      100, 101, 103, 102, 102, 104, 105, 104, 4, 250, 0, 255, 128, 7, 199, 3,
    ];
    const rsi2 = [
      60, 60, 60, 60, 60, 60, 60, 60, 61, 61, 60, 62, 62, 63, 63, 63,
    ];
    const residuals = (samples: number[]) =>
      samples.slice(1).map((x, i) => map(x, samples[i], 0, 255));
    const r1 = residuals(rsi1);
    const r2 = residuals(rsi2);
    const w = new BitWriter();
    const idLength = 3;

    // RSI 1, block 1: split with k = 1, with the reference sample.
    w.write(2, idLength);
    w.write(rsi1[0], n);
    r1.slice(0, 7).forEach((d) => w.fs(d >> 1));
    r1.slice(0, 7).forEach((d) => w.write(d & 1, 1));
    // RSI 1, block 2: no compression.
    w.write(7, idLength);
    r1.slice(7, 15).forEach((d) => w.write(d, n));
    // RSI 2, block 1: zero block (one block), with the reference sample.
    w.write(0, idLength);
    w.write(0, 1);
    w.write(rsi2[0], n);
    w.fs(0);
    expect(r2.slice(0, 7).every((d) => d === 0)).toBe(true);
    // RSI 2, block 2: second extension, pairs of residuals.
    w.write(0, idLength);
    w.write(1, 1);
    const block = r2.slice(7, 15);
    for (let i = 0; i < J; i += 2) {
      const [d0, d1] = [block[i], block[i + 1]];
      w.fs(((d0 + d1) * (d0 + d1 + 1)) / 2 + d1);
    }

    const decoded = aecDecode(w.bytes(), 32, params);
    expect(Array.from(decoded)).toEqual([...rsi1, ...rsi2]);
  });

  it('stops at the number of samples asked for', () => {
    const w = new BitWriter();
    w.write(0, 3);
    w.write(0, 1);
    w.write(42, n);
    w.fs(0);
    expect(Array.from(aecDecode(w.bytes(), 5, params))).toEqual([
      42, 42, 42, 42, 42,
    ]);
  });
});

describe('winds grid', () => {
  // Two levels, two steps, 3 x 3 points: wind from 270 at 20 kt at
  // 850 hPa, from 360 at 20 kt at 700 hPa, +10 kt at the second step.
  const grid = (): WindsGrid => {
    const header = {
      schema: GRID_SCHEMA,
      model: 'ICON-EU',
      run: '2026-10-17T00:00:00.000Z',
      steps: [0, 6],
      levels: [850, 700],
      lat0: 48,
      lon0: 1,
      dLat: 1,
      dLon: 1,
      nLat: 3,
      nLon: 3,
      createdAt: '',
      attribution: 'test',
    };
    const data = new Int16Array(2 * 2 * 3 * 9);
    const kt = 1852 / 3600;
    let i = 0;
    for (let step = 0; step < 2; step++)
      for (let level = 0; level < 2; level++)
        for (let variable = 0; variable < 3; variable++)
          for (let p = 0; p < 9; p++) {
            const speed = (20 + 10 * step) * kt;
            const value =
              variable === 2
                ? 280
                : level === 0
                  ? variable === 0
                    ? speed
                    : 0
                  : variable === 1
                    ? -speed
                    : 0;
            data[i++] = quantize(GRID_VARIABLES[variable], value);
          }
    return { header, data };
  };

  it('round-trips through its compact file', () => {
    const original = grid();
    const decoded = decodeGrid(encodeGrid(original));
    expect(decoded.header).toEqual(original.header);
    expect(Array.from(decoded.data)).toEqual(Array.from(original.data));
  });

  it('reads a level, interpolates in altitude and time as components', () => {
    const g = grid();
    const at850 = pressureAltitudeOfHpa(850);
    const at700 = pressureAltitudeOfHpa(700);
    const a = sampleGrid(
      g,
      49,
      2,
      at850,
      1013.25,
      new Date('2026-10-17T00:00:00Z'),
    );
    expect(a.fromDeg).toBeCloseTo(270, 1);
    expect(a.speedKt).toBeCloseTo(20, 1);
    expect(a.temperatureC).toBeCloseTo(6.85, 2);
    // Half way between the levels: (20 kt from W + 20 kt from N) / 2.
    const mid = sampleGrid(
      g,
      49,
      2,
      (at850 + at700) / 2,
      1013.25,
      new Date('2026-10-17T00:00:00Z'),
    );
    expect(mid.fromDeg).toBeCloseTo(315, 1);
    expect(mid.speedKt).toBeCloseTo(Math.SQRT2 * 10, 1);
    // Half way between the steps.
    const later = sampleGrid(
      g,
      49,
      2,
      at850,
      1013.25,
      new Date('2026-10-17T03:00:00Z'),
    );
    expect(later.speedKt).toBeCloseTo(25, 1);
    // QNH: the same altitude AMSL is a higher pressure altitude on a low QNH.
    const low = sampleGrid(
      g,
      49,
      2,
      at850 - 280,
      1003,
      new Date('2026-10-17T00:00:00Z'),
    );
    expect(low.fromDeg).toBeCloseTo(270, 0);
  });

  it('says nothing outside the grid, above its top level or its forecast range', () => {
    const g = grid();
    expect(
      sampleGrid(g, 55, 2, 3000, 1013.25, new Date('2026-10-17T00:00:00Z')),
    ).toBeNull();
    expect(
      sampleGrid(g, 49, 2, 15000, 1013.25, new Date('2026-10-17T00:00:00Z')),
    ).toBeNull();
    expect(
      sampleGrid(g, 49, 2, 3000, 1013.25, new Date('2026-10-17T07:00:00Z')),
    ).toBeNull();
  });
});
