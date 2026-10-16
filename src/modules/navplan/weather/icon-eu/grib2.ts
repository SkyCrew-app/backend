import { aecDecode } from './aec';

// Minimal GRIB2 reader for the DWD ICON-EU open data files: regular
// latitude/longitude grid (template 3.0), analysis or forecast at a level
// (template 4.0), simple packing (5.0) or CCSDS packing (5.42), no bitmap.

export class GribError extends Error {}

export interface GribField {
  discipline: number;
  category: number;
  parameter: number;
  levelType: number;
  levelValue: number;
  referenceTime: Date;
  forecastHours: number;
  ni: number;
  nj: number;
  lat1: number;
  lon1: number;
  dLat: number; // signed: + when j goes north
  dLon: number;
  values: Float64Array; // i (west->east) fastest
}

const signedInt = (value: number, bytes: number) => {
  const sign = 2 ** (bytes * 8 - 1);
  return value & sign ? -(value - sign) : value;
};

const readUInt = (buffer: Buffer, offset: number, bytes: number) =>
  bytes === 4
    ? buffer.readUInt32BE(offset)
    : bytes === 2
      ? buffer.readUInt16BE(offset)
      : buffer[offset];

// Sign-and-magnitude integers, as GRIB2 writes them.
const sm = (buffer: Buffer, offset: number, bytes: number) =>
  signedInt(readUInt(buffer, offset, bytes), bytes);

export function readGrib2(buffer: Buffer): GribField {
  if (buffer.toString('ascii', 0, 4) !== 'GRIB' || buffer[7] !== 2) {
    throw new GribError('Not a GRIB2 message');
  }
  const discipline = buffer[6];
  let offset = 16;
  let referenceTime = new Date(0);
  let grid: Pick<
    GribField,
    'ni' | 'nj' | 'lat1' | 'lon1' | 'dLat' | 'dLon'
  > | null = null;
  let product: Pick<
    GribField,
    'category' | 'parameter' | 'levelType' | 'levelValue' | 'forecastHours'
  > | null = null;
  let packing: {
    template: number;
    points: number;
    reference: number;
    binaryScale: number;
    decimalScale: number;
    bits: number;
    flags: number;
    blockSize: number;
    rsi: number;
  } | null = null;
  let values: Float64Array | null = null;

  while (offset < buffer.length - 4) {
    if (buffer.toString('ascii', offset, offset + 4) === '7777') break;
    const length = buffer.readUInt32BE(offset);
    const section = buffer[offset + 4];
    const s = offset;
    if (section === 1) {
      referenceTime = new Date(
        Date.UTC(
          buffer.readUInt16BE(s + 12),
          buffer[s + 14] - 1,
          buffer[s + 15],
          buffer[s + 16],
          buffer[s + 17],
          buffer[s + 18],
        ),
      );
    } else if (section === 3) {
      const template = buffer.readUInt16BE(s + 12);
      if (template !== 0)
        throw new GribError(`Grid template 3.${template} not supported`);
      const ni = buffer.readUInt32BE(s + 30);
      const nj = buffer.readUInt32BE(s + 34);
      const basicAngle = buffer.readUInt32BE(s + 38);
      const subdivisions = buffer.readUInt32BE(s + 42);
      const unit =
        basicAngle === 0 ||
        basicAngle === 0xffffffff ||
        subdivisions === 0xffffffff
          ? 1e-6
          : basicAngle / subdivisions;
      const lat1 = sm(buffer, s + 46, 4) * unit;
      let lon1 = sm(buffer, s + 50, 4) * unit;
      const di = buffer.readUInt32BE(s + 63) * unit;
      const dj = buffer.readUInt32BE(s + 67) * unit;
      const scanning = buffer[s + 71];
      if (scanning & 0x80) throw new GribError('Scanning -i not supported');
      if (scanning & 0x20)
        throw new GribError('Column-major scanning not supported');
      if (lon1 > 180) lon1 -= 360;
      grid = { ni, nj, lat1, lon1, dLat: scanning & 0x40 ? dj : -dj, dLon: di };
    } else if (section === 4) {
      const template = buffer.readUInt16BE(s + 7);
      if (template !== 0)
        throw new GribError(`Product template 4.${template} not supported`);
      const unitOfTime = buffer[s + 17];
      const forecast = buffer.readUInt32BE(s + 18);
      const hours =
        unitOfTime === 1
          ? forecast
          : unitOfTime === 0
            ? forecast / 60
            : unitOfTime === 2
              ? forecast * 24
              : forecast;
      const levelScale = signedInt(buffer[s + 23], 1);
      const levelRaw = buffer.readUInt32BE(s + 24);
      product = {
        category: buffer[s + 9],
        parameter: buffer[s + 10],
        levelType: buffer[s + 22],
        levelValue: levelRaw / 10 ** levelScale,
        forecastHours: hours,
      };
    } else if (section === 5) {
      const template = buffer.readUInt16BE(s + 9);
      if (template !== 0 && template !== 42) {
        throw new GribError(
          `Data representation template 5.${template} not supported`,
        );
      }
      packing = {
        template,
        points: buffer.readUInt32BE(s + 5),
        reference: buffer.readFloatBE(s + 11),
        binaryScale: sm(buffer, s + 15, 2),
        decimalScale: sm(buffer, s + 17, 2),
        bits: buffer[s + 19],
        flags: template === 42 ? buffer[s + 21] : 0,
        blockSize: template === 42 ? buffer[s + 22] : 0,
        rsi: template === 42 ? buffer.readUInt16BE(s + 23) : 0,
      };
    } else if (section === 6) {
      if (buffer[s + 5] !== 255)
        throw new GribError('Bitmaps are not supported');
    } else if (section === 7) {
      if (!packing) throw new GribError('Data before its representation');
      const data = buffer.subarray(s + 5, s + length);
      const { points, reference, binaryScale, decimalScale, bits } = packing;
      const scale = 2 ** binaryScale;
      const divisor = 10 ** decimalScale;
      let raw: Float64Array;
      if (bits === 0) {
        raw = new Float64Array(points);
      } else if (packing.template === 42) {
        raw = aecDecode(data, points, {
          bitsPerSample: bits,
          blockSize: packing.blockSize,
          rsi: packing.rsi,
          flags: packing.flags,
        });
      } else {
        raw = new Float64Array(points);
        let bit = 0;
        for (let i = 0; i < points; i++) {
          let value = 0;
          for (let b = 0; b < bits; b++, bit++) {
            value = value * 2 + ((data[bit >>> 3] >>> (7 - (bit & 7))) & 1);
          }
          raw[i] = value;
        }
      }
      values = new Float64Array(points);
      for (let i = 0; i < points; i++)
        values[i] = (reference + raw[i] * scale) / divisor;
    }
    offset += length;
  }
  if (!grid || !product || !values)
    throw new GribError('Incomplete GRIB2 message');
  if (values.length !== grid.ni * grid.nj)
    throw new GribError('Grid and data sizes differ');
  return { discipline, referenceTime, ...grid, ...product, values };
}
