import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { weatherUserAgent } from '../navplan/weather/metar-taf.service';

export interface MetarData {
  icaoId: string;
  rawOb: string;
  temp: number;
  dewp: number;
  wdir: number | string;
  wspd: number;
  wgst: number | null;
  visib: number | string;
  altim: number;
  fltcat: string;
  clouds: Array<{ cover: string; base: number | null }>;
}

@Injectable()
export class MetarService {
  private readonly logger = new Logger(MetarService.name);
  private readonly METAR_URL = 'https://aviationweather.gov/api/data/metar';

  // aviationweather.gov asks for a custom User-Agent and at most 100
  // requests a minute: reports are kept 5 minutes.
  private readonly cache = new Map<
    string,
    { at: number; value: MetarData | null }
  >();

  async fetchMetar(icao: string): Promise<MetarData | null> {
    const key = icao.toUpperCase();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
    try {
      const response = await axios.get(this.METAR_URL, {
        params: { ids: key, format: 'json' },
        headers: { 'User-Agent': weatherUserAgent() },
        timeout: 5000,
      });
      const value =
        Array.isArray(response.data) && response.data.length > 0
          ? (response.data[0] as MetarData)
          : null;
      this.cache.set(key, { at: Date.now(), value });
      return value;
    } catch (error: any) {
      this.logger.warn(`METAR unavailable for ${icao}: ${error.message}`);
      return null;
    }
  }

  async fetchMetarSafe(icao: string): Promise<MetarData | null> {
    try {
      return await this.fetchMetar(icao);
    } catch {
      return null;
    }
  }
}
