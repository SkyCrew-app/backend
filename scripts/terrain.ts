/*
 * The terrain grid shipped with the code, for the minimum safe altitude and
 * the vertical profile of the flight plans.
 *
 *   npm run terrain:build -- --cache /tmp/dem \
 *     [--bbox 41,-6,52,10] [--out src/modules/navdata/data/terrain-grid.bin.gz]
 *
 * Source: Copernicus DEM GLO-90 (90 m, 3 arc-seconds, cloud-optimised
 * GeoTIFF of one degree each), downloaded from the public AWS bucket of the
 * ESA into --cache (several hundred MB; never into the repository). A tile
 * missing from the bucket is sea and counts as 0 ft. Licence: free for any
 * use, commercial included, with this attribution (shown with the plans):
 *   Contient des données Copernicus DEM GLO-90 © DLR e.V. 2010-2014 et
 *   © Airbus Defence and Space GmbH 2014-2018, fournies dans le cadre de
 *   COPERNICUS par l'Union européenne et l'ESA.
 *
 * Output: the HIGHEST elevation of each 30 arc-second cell (about 0.5 NM),
 * in feet rounded up, int16 (see src/modules/navplan/terrain/terrain-file.ts
 * for the format), gzipped, and its SHA-256 next to it. The default box is
 * metropolitan France and Corsica with a margin: 41-52 N, 6 W-10 E.
 * Each DEM pixel counts in every cell its footprint touches, so the half
 * pixel between the "pixel is point" and "pixel is area" conventions can
 * only raise a cell.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fromArrayBuffer } from 'geotiff';
import {
  TERRAIN_ATTRIBUTION,
  TERRAIN_SOURCE,
  TerrainGrid,
} from '../src/modules/navplan/engine/terrain';
import {
  decodeTerrainGrid,
  encodeTerrainGrid,
  TERRAIN_FILE,
  terrainSha256,
} from '../src/modules/navplan/terrain/terrain-file';

const BUCKET = 'https://copernicus-dem-90m.s3.amazonaws.com';
const CELLS_PER_DEGREE = 120; // 30 arc-seconds
const NO_DATA = -32768;
const FEET_PER_METRE = 1 / 0.3048;
const PARALLEL_DOWNLOADS = 4;

const args = process.argv.slice(2);
const option = (name: string): string | null => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? null) : null;
};

const tileName = (lat: number, lon: number) => {
  const ns = `${lat < 0 ? 'S' : 'N'}${String(Math.abs(lat)).padStart(2, '0')}`;
  const ew = `${lon < 0 ? 'W' : 'E'}${String(Math.abs(lon)).padStart(3, '0')}`;
  return `Copernicus_DSM_COG_30_${ns}_00_${ew}_00_DEM`;
};

// The tile from the cache, else from the bucket; null when the bucket has
// none (sea).
async function tile(cache: string, lat: number, lon: number) {
  const name = tileName(lat, lon);
  const file = join(cache, `${name}.tif`);
  const missing = join(cache, `${name}.missing`);
  if (existsSync(file)) return readFileSync(file);
  if (existsSync(missing)) return null;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`${BUCKET}/${name}/${name}.tif`);
      if (response.status === 404 || response.status === 403) {
        writeFileSync(missing, '');
        return null;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      writeFileSync(file, data);
      return data;
    } catch (error) {
      if (attempt >= 4) throw error;
      console.warn(`${name}: ${(error as Error).message}, retrying`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

// Raises the cells of `grid` with the pixels of one tile.
async function addTile(grid: TerrainGrid, data: Buffer) {
  const tiff = await fromArrayBuffer(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  );
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const resX = (maxX - minX) / width;
  const resY = (maxY - minY) / height;
  const noData = image.getGDALNoData();
  const [raster] =
    (await image.readRasters()) as unknown as ArrayLike<number>[];
  // The cells each pixel column and row touches.
  const colRange = (j: number) => {
    const west = minX + j * resX;
    return [
      Math.floor((west - grid.west) * CELLS_PER_DEGREE + 1e-9),
      Math.floor((west + resX - grid.west) * CELLS_PER_DEGREE - 1e-9),
    ];
  };
  const rowRange = (i: number) => {
    const north = maxY - i * resY;
    return [
      Math.floor((grid.north - north) * CELLS_PER_DEGREE + 1e-9),
      Math.floor((grid.north - (north - resY)) * CELLS_PER_DEGREE - 1e-9),
    ];
  };
  const cols = Array.from({ length: width }, (_, j) => colRange(j));
  for (let i = 0; i < height; i++) {
    const [r0, r1] = rowRange(i);
    for (let j = 0; j < width; j++) {
      const metres = raster[i * width + j];
      if (!Number.isFinite(metres) || metres === noData || metres < -1000)
        continue;
      const feet = Math.ceil(metres * FEET_PER_METRE);
      const [c0, c1] = cols[j];
      for (let r = Math.max(r0, 0); r <= Math.min(r1, grid.rows - 1); r++)
        for (let c = Math.max(c0, 0); c <= Math.min(c1, grid.cols - 1); c++) {
          const k = r * grid.cols + c;
          if (grid.data[k] === NO_DATA || feet > grid.data[k])
            grid.data[k] = feet;
        }
    }
  }
}

async function build() {
  const cache = option('cache');
  if (!cache) throw new Error('--cache <directory for the DEM tiles> needed');
  mkdirSync(cache, { recursive: true });
  const [south, west, north, east] = (option('bbox') ?? '41,-6,52,10')
    .split(',')
    .map(Number);
  const out =
    option('out') ?? join('src', 'modules', 'navdata', 'data', TERRAIN_FILE);
  const rows = (north - south) * CELLS_PER_DEGREE;
  const cols = (east - west) * CELLS_PER_DEGREE;
  const grid: TerrainGrid = {
    south,
    west,
    north,
    east,
    cellDeg: 1 / CELLS_PER_DEGREE,
    rows,
    cols,
    data: new Int16Array(rows * cols).fill(NO_DATA),
    noData: NO_DATA,
  };
  const tiles: [number, number][] = [];
  for (let lat = south; lat < north; lat++)
    for (let lon = west; lon < east; lon++) tiles.push([lat, lon]);
  const sea: [number, number][] = [];
  let done = 0;
  const queue = [...tiles];
  await Promise.all(
    Array.from({ length: PARALLEL_DOWNLOADS }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [lat, lon] = next;
        const data = await tile(cache, lat, lon);
        if (data) await addTile(grid, data);
        else sea.push([lat, lon]);
        done++;
        if (done % 10 === 0 || done === tiles.length)
          console.log(`${done}/${tiles.length} tiles (${sea.length} sea)`);
      }
    }),
  );
  // Cells of the tiles the bucket does not have: sea level.
  for (const [lat, lon] of sea) {
    const r0 = (north - lat - 1) * CELLS_PER_DEGREE;
    const c0 = (lon - west) * CELLS_PER_DEGREE;
    for (let r = r0; r < r0 + CELLS_PER_DEGREE; r++)
      for (let c = c0; c < c0 + CELLS_PER_DEGREE; c++) {
        const k = r * cols + c;
        if (grid.data[k] === NO_DATA) grid.data[k] = 0;
      }
  }
  const empty = grid.data.filter((v) => v === NO_DATA).length;
  if (empty > 0) throw new Error(`${empty} cells without data`);
  const file = encodeTerrainGrid(grid, {
    source: `${TERRAIN_SOURCE} (${BUCKET}), maximum per cell`,
    attribution: TERRAIN_ATTRIBUTION,
    builtAt: new Date().toISOString(),
  });
  // Read back before writing anything.
  const check = decodeTerrainGrid(file).grid;
  if (check.data.some((v, i) => v !== grid.data[i]))
    throw new Error('The grid does not read back');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, file);
  writeFileSync(`${out}.sha256`, `${terrainSha256(file)}  ${TERRAIN_FILE}\n`);
  let highest = 0;
  for (const v of grid.data) highest = Math.max(highest, v);
  console.log(
    `${out}: ${rows} x ${cols} cells, highest ${highest} ft, ${(file.length / 1e6).toFixed(2)} MB`,
  );
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
