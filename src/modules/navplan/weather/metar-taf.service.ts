import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { WeatherReport } from '../engine/engine';

// METAR and TAF from the aviationweather.gov Data API (NOAA/NWS, public
// domain: https://aviationweather.gov/data/api/). Their rules: a custom
// User-Agent, at most 100 requests a minute; we cache 5 minutes and stay
// under 60 a minute. The reports are shown raw, never edited.

const API =
  process.env.AVIATIONWEATHER_URL ?? 'https://aviationweather.gov/api/data';
const CACHE_MS = 5 * 60_000;
const MAX_REQUESTS_PER_MINUTE = 60;

export const weatherUserAgent = () =>
  `Skycrew-flight-preparation/1.0 (aeroclub management; ${process.env.PUBLIC_URL || 'self-hosted'})`;

interface Cached<T> {
  at: number;
  value: T;
}

export interface MetarJson {
  icaoId: string;
  rawOb?: string;
  obsTime?: number;
  reportTime?: string;
  altim?: number;
  lat?: number;
  lon?: number;
}

interface TafJson {
  icaoId: string;
  rawTAF?: string;
}

@Injectable()
export class MetarTafService {
  private readonly logger = new Logger(MetarTafService.name);
  private readonly cache = new Map<string, Cached<unknown>>();
  private requests: number[] = [];

  private allowRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < 60_000);
    if (this.requests.length >= MAX_REQUESTS_PER_MINUTE) return false;
    this.requests.push(now);
    return true;
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T | null> {
    const key = `${path}?${new URLSearchParams(params).toString()}`;
    const cached = this.cache.get(key) as Cached<T> | undefined;
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
    if (!this.allowRequest()) {
      this.logger.warn(
        'aviationweather.gov: local rate limit reached, using cache only',
      );
      return cached?.value ?? null;
    }
    try {
      const response = await axios.get<T>(`${API}/${path}`, {
        params: { ...params, format: 'json' },
        headers: { 'User-Agent': weatherUserAgent() },
        timeout: 8000,
      });
      this.cache.set(key, { at: Date.now(), value: response.data });
      return response.data;
    } catch (error) {
      this.logger.warn(
        `aviationweather.gov ${path} unavailable: ${(error as Error)?.message}`,
      );
      return cached?.value ?? null;
    }
  }

  async metars(icaos: string[]): Promise<MetarJson[]> {
    if (icaos.length === 0) return [];
    const data = await this.get<MetarJson[]>('metar', { ids: icaos.join(',') });
    return Array.isArray(data) ? data : [];
  }

  async metarsInBox(box: {
    south: number;
    west: number;
    north: number;
    east: number;
  }): Promise<MetarJson[]> {
    const data = await this.get<MetarJson[]>('metar', {
      bbox: [box.south, box.west, box.north, box.east]
        .map((v) => v.toFixed(2))
        .join(','),
    });
    return Array.isArray(data) ? data : [];
  }

  async tafs(icaos: string[]): Promise<TafJson[]> {
    if (icaos.length === 0) return [];
    const data = await this.get<TafJson[]>('taf', { ids: icaos.join(',') });
    return Array.isArray(data) ? data : [];
  }

  // Reports for the given aerodromes (METAR and TAF), plus the METARs of
  // `nearby` aerodromes, in that order.
  async reports(
    icaos: string[],
    nearby: MetarJson[] = [],
  ): Promise<WeatherReport[]> {
    const unique = [...new Set(icaos.map((i) => i.toUpperCase()))].filter((i) =>
      /^[A-Z]{4}$/.test(i),
    );
    const [metars, tafs] = await Promise.all([
      this.metars(unique),
      this.tafs(unique),
    ]);
    const reports: WeatherReport[] = unique.map((icao) => {
      const metar = metars.find((m) => m.icaoId === icao);
      return {
        icao,
        metar: metar?.rawOb ?? null,
        taf: tafs.find((t) => t.icaoId === icao)?.rawTAF ?? null,
        observedAt: metar?.obsTime ? new Date(metar.obsTime * 1000) : null,
      };
    });
    for (const metar of nearby) {
      if (unique.includes(metar.icaoId)) continue;
      reports.push({
        icao: metar.icaoId,
        metar: metar.rawOb ?? null,
        taf: null,
        observedAt: metar.obsTime ? new Date(metar.obsTime * 1000) : null,
      });
    }
    return reports;
  }

  async qnhOf(icao: string): Promise<number | null> {
    const [metar] = await this.metars([icao.toUpperCase()]);
    const altim = Number(metar?.altim);
    // The API gives hPa; an inch value would be below 40.
    if (!Number.isFinite(altim) || altim <= 0) return null;
    return altim < 40 ? altim * 33.8639 : altim;
  }
}
