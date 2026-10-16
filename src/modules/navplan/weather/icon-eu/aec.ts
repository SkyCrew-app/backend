// Decoder for CCSDS 121.0-B lossless compression (Adaptive Entropy Coding),
// the packing of GRIB2 data representation template 5.42 used by the DWD
// open data files. Written from the CCSDS 121.0-B-3 blue book and the
// behaviour of libaec (BSD-2-Clause), which encodes these files.

export const AEC_DATA_SIGNED = 1;
export const AEC_DATA_3BYTE = 2;
export const AEC_DATA_MSB = 4;
export const AEC_DATA_PREPROCESS = 8;
export const AEC_RESTRICTED = 16;
export const AEC_PAD_RSI = 32;

const ROS = 5;

export class AecError extends Error {}

class BitReader {
  private position = 0; // in bits
  constructor(private readonly data: Uint8Array) {}

  get exhausted(): boolean {
    return this.position >= this.data.length * 8;
  }

  bit(): number {
    const byte = this.data[this.position >>> 3];
    if (byte === undefined) throw new AecError('Unexpected end of data');
    const value = (byte >>> (7 - (this.position & 7))) & 1;
    this.position++;
    return value;
  }

  bits(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i++) value = value * 2 + this.bit();
    return value;
  }

  // Fundamental sequence: the number of 0 bits before the next 1.
  fs(): number {
    let count = 0;
    while (this.bit() === 0) count++;
    return count;
  }

  alignToByte(): void {
    this.position = Math.ceil(this.position / 8) * 8;
  }
}

// Second extension table: for m, beta and the triangular number below it.
const SE_TABLE: [number, number][] = (() => {
  const table: [number, number][] = [];
  for (let beta = 0; beta < 13; beta++) {
    const ms = table.length;
    for (let j = 0; j <= beta; j++) table.push([beta, ms]);
  }
  return table;
})();

export interface AecParameters {
  bitsPerSample: number;
  blockSize: number;
  rsi: number; // blocks per reference sample interval
  flags: number;
}

// Returns the `count` decoded samples (unsigned, or signed with
// AEC_DATA_SIGNED).
export function aecDecode(
  data: Uint8Array,
  count: number,
  params: AecParameters,
): Float64Array {
  const { bitsPerSample: n, blockSize: J, rsi, flags } = params;
  const preprocess = (flags & AEC_DATA_PREPROCESS) !== 0;
  const signed = (flags & AEC_DATA_SIGNED) !== 0;
  const restricted = (flags & AEC_RESTRICTED) !== 0;
  const idLength =
    n > 16 ? 5 : n > 8 ? 4 : restricted && n <= 4 ? (n <= 2 ? 1 : 2) : 3;
  const uncompressedId = 2 ** idLength - 1;
  const xmax = signed ? 2 ** (n - 1) - 1 : 2 ** n - 1;
  const xmin = signed ? -(2 ** (n - 1)) : 0;

  const reader = new BitReader(data);
  const out = new Float64Array(count);
  let written = 0;
  const rsiSamples = rsi * J;

  while (written < count) {
    // One reference sample interval of mapped residuals.
    const buffer: number[] = [];
    let blocksDone = 0;
    while (blocksDone < rsi && written + buffer.length < count) {
      const ref = preprocess && buffer.length === 0 ? 1 : 0;
      const id = reader.bits(idLength);
      if (id === 0) {
        const second = reader.bit();
        if (ref) buffer.push(reader.bits(n));
        if (second === 1) {
          for (let i = ref; i < J; ) {
            const m = reader.fs();
            const entry = SE_TABLE[m];
            if (!entry) throw new AecError('Invalid second extension code');
            const d1 = m - entry[1];
            if ((i & 1) === 0) {
              buffer.push(entry[0] - d1);
              i++;
            }
            buffer.push(d1);
            i++;
          }
          blocksDone++;
        } else {
          let zeroBlocks = reader.fs() + 1;
          if (zeroBlocks === ROS) {
            zeroBlocks = Math.min(rsi - blocksDone, 64 - (blocksDone % 64));
          } else if (zeroBlocks > ROS) {
            zeroBlocks--;
          }
          const zeros = zeroBlocks * J - ref;
          for (let i = 0; i < zeros; i++) buffer.push(0);
          blocksDone += zeroBlocks;
        }
      } else if (id === uncompressedId) {
        for (let i = 0; i < J; i++) buffer.push(reader.bits(n));
        blocksDone++;
      } else {
        const k = id - 1;
        if (ref) buffer.push(reader.bits(n));
        const size = J - ref;
        const start = buffer.length;
        for (let i = 0; i < size; i++) buffer.push(reader.fs() * 2 ** k);
        if (k > 0)
          for (let i = 0; i < size; i++) buffer[start + i] += reader.bits(k);
        blocksDone++;
      }
    }
    if (buffer.length > rsiSamples) buffer.length = rsiSamples;

    // Inverse of the unit-delay predictor and of the mapping.
    if (preprocess) {
      let x = buffer[0];
      if (signed && x > xmax) x -= 2 ** n;
      if (written < count) out[written++] = x;
      for (let i = 1; i < buffer.length && written < count; i++) {
        const d = buffer[i];
        const theta = Math.min(x - xmin, xmax - x);
        if (Math.ceil(d / 2) <= theta) {
          x += d % 2 === 0 ? d / 2 : -(d + 1) / 2;
        } else if (theta === x - xmin) {
          x = xmin + d;
        } else {
          x = xmax - d;
        }
        out[written++] = x;
      }
    } else {
      for (let i = 0; i < buffer.length && written < count; i++) {
        let x = buffer[i];
        if (signed && x > xmax) x -= 2 ** n;
        out[written++] = x;
      }
    }
    if (flags & AEC_PAD_RSI) reader.alignToByte();
  }
  return out;
}
