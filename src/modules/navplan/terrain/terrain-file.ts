import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync, gzipSync } from 'zlib';
import { TerrainGrid } from '../engine/terrain';

// The terrain grid file shipped with the code (built by scripts/terrain.ts):
//
//   "SKYTERR1"                  8 bytes
//   header length               uint32, little endian
//   header                      JSON: south, west, north, east, cellDeg,
//                               rows, cols, unit ("ft"), noData, source,
//                               attribution, builtAt
//   elevations                  rows x cols int16, little endian, row 0
//                               the northern one; stored as the high
//                               bytes of every cell then the low bytes,
//                               which gzip compresses far better
//
// gzipped, with its SHA-256 in "<file>.sha256" next to it.

export const TERRAIN_FILE = 'terrain-grid.bin.gz';
const MAGIC = 'SKYTERR1';

export interface TerrainHeader {
  south: number;
  west: number;
  north: number;
  east: number;
  cellDeg: number;
  rows: number;
  cols: number;
  unit: 'ft';
  noData: number;
  source: string;
  attribution: string;
  builtAt: string;
}

export function encodeTerrainGrid(
  grid: TerrainGrid,
  header: Omit<TerrainHeader, keyof TerrainGrid | 'unit'>,
): Buffer {
  const json = Buffer.from(
    JSON.stringify({
      south: grid.south,
      west: grid.west,
      north: grid.north,
      east: grid.east,
      cellDeg: grid.cellDeg,
      rows: grid.rows,
      cols: grid.cols,
      unit: 'ft',
      noData: grid.noData,
      ...header,
    }),
  );
  const length = Buffer.alloc(4);
  length.writeUInt32LE(json.length);
  const cells = grid.rows * grid.cols;
  const body = Buffer.alloc(cells * 2);
  for (let i = 0; i < cells; i++) {
    const value = grid.data[i] & 0xffff;
    body[i] = value >> 8;
    body[cells + i] = value & 0xff;
  }
  return gzipSync(Buffer.concat([Buffer.from(MAGIC), length, json, body]), {
    level: 9,
  });
}

export function decodeTerrainGrid(file: Buffer): {
  grid: TerrainGrid;
  header: TerrainHeader;
} {
  const raw = gunzipSync(file);
  if (raw.subarray(0, 8).toString() !== MAGIC)
    throw new Error('Not a terrain grid file');
  const length = raw.readUInt32LE(8);
  const header = JSON.parse(
    raw.subarray(12, 12 + length).toString(),
  ) as TerrainHeader;
  const cells = header.rows * header.cols;
  const body = raw.subarray(12 + length);
  if (body.length !== cells * 2) throw new Error('Truncated terrain grid');
  const data = new Int16Array(cells);
  for (let i = 0; i < cells; i++)
    data[i] = (((body[i] << 8) | body[cells + i]) << 16) >> 16;
  return {
    header,
    grid: {
      south: header.south,
      west: header.west,
      north: header.north,
      east: header.east,
      cellDeg: header.cellDeg,
      rows: header.rows,
      cols: header.cols,
      data,
      noData: header.noData,
    },
  };
}

export const terrainSha256 = (file: Buffer) =>
  createHash('sha256').update(file).digest('hex');

export const terrainFilePath = (): string | null => {
  const candidates = [
    join(__dirname, '..', '..', 'navdata', 'data', TERRAIN_FILE),
    join(process.cwd(), 'src', 'modules', 'navdata', 'data', TERRAIN_FILE),
    join(
      process.cwd(),
      'dist',
      'src',
      'modules',
      'navdata',
      'data',
      TERRAIN_FILE,
    ),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
};

// The grid, checked against its SHA-256 when the file is there.
export function loadTerrainGrid(path = terrainFilePath()): TerrainGrid | null {
  if (!path) return null;
  const file = readFileSync(path);
  const checksum = `${path}.sha256`;
  if (existsSync(checksum)) {
    const expected = readFileSync(checksum, 'utf8').split(/\s/)[0];
    if (expected && terrainSha256(file) !== expected.toLowerCase())
      throw new Error(`${path}: SHA-256 mismatch`);
  }
  return decodeTerrainGrid(file).grid;
}
