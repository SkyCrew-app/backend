import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { spawn } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { WindProvider } from '../engine/engine';
import { windsDir } from './icon-eu/fetch-job';
import { decodeGrid, sampleGrid, WindsGrid } from './winds-grid';

const RELOAD_MS = 5 * 60_000;

// Winds and temperatures aloft from the latest ICON-EU grid on disk
// (WINDS_DIR). The grid is produced by a separate process
// (icon-eu/fetch-job), started here twice a day (00Z and 12Z runs) when
// WINDS_ALOFT_FETCH=true.
@Injectable()
export class WindsAloftService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WindsAloftService.name);
  private grid: { file: string; mtime: number; data: WindsGrid } | null = null;
  private checkedAt = 0;
  private running = false;

  // A new installation (or one whose grid is more than 12 hours old) gets
  // its first grid without waiting for the next scheduled run.
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    const grid = this.current();
    const age = grid
      ? Date.now() - new Date(grid.header.run).getTime()
      : Infinity;
    if (age > 12 * 3_600_000) this.fetchScheduled();
  }

  current(): WindsGrid | null {
    if (Date.now() - this.checkedAt < RELOAD_MS && this.grid)
      return this.grid.data;
    this.checkedAt = Date.now();
    try {
      const dir = windsDir();
      if (!existsSync(dir)) return this.grid?.data ?? null;
      const latest = readdirSync(dir)
        .filter((f) => /^winds-icon-eu-\d{10}\.bin\.gz$/.test(f))
        .sort()
        .pop();
      if (!latest) return this.grid?.data ?? null;
      const file = join(dir, latest);
      const mtime = statSync(file).mtimeMs;
      if (this.grid?.file !== file || this.grid.mtime !== mtime) {
        this.grid = { file, mtime, data: decodeGrid(readFileSync(file)) };
        this.logger.log(`Winds grid loaded: ${latest}`);
      }
    } catch (error) {
      this.logger.warn(`Winds grid not readable: ${(error as Error)?.message}`);
    }
    return this.grid?.data ?? null;
  }

  // For tests and for an installation fed by another process.
  use(grid: WindsGrid | null): void {
    this.grid = grid ? { file: 'memory', mtime: 0, data: grid } : null;
    this.checkedAt = Date.now();
  }

  provider(qnhHpa: number): { provider: WindProvider | null; source: string } {
    const grid = this.current();
    if (!grid) {
      return {
        provider: null,
        source:
          'Aucune prévision de vent en altitude disponible / no winds aloft forecast',
      };
    }
    const run = grid.header.run.slice(0, 13).replace('T', ' ') + 'Z';
    return {
      provider: (lat, lon, altitudeFt, time) => {
        const sample = sampleGrid(grid, lat, lon, altitudeFt, qnhHpa, time);
        return sample
          ? {
              fromDeg: sample.fromDeg,
              speedKt: sample.speedKt,
              temperatureC: sample.temperatureC,
              validAt: sample.validAt,
            }
          : null;
      },
      source: `DWD ICON-EU run ${run} — ${grid.header.attribution}`,
    };
  }

  @Cron('20 3,15 * * *', { timeZone: 'UTC' })
  fetchScheduled(): void {
    if (process.env.WINDS_ALOFT_FETCH !== 'true' || this.running) return;
    const script = join(__dirname, 'icon-eu', 'fetch-job.js');
    if (!existsSync(script)) {
      this.logger.warn(`Winds job not found at ${script}`);
      return;
    }
    this.running = true;
    const child = spawn(process.execPath, [script, windsDir()], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      this.running = false;
      this.checkedAt = 0;
      if (code !== 0) this.logger.error(`Winds job exited with ${code}`);
    });
    child.on('error', (error) => {
      this.running = false;
      this.logger.error(`Winds job not started: ${error.message}`);
    });
  }
}
