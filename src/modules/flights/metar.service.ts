import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

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

  async fetchMetar(icao: string): Promise<MetarData | null> {
    try {
      const response = await axios.get(this.METAR_URL, {
        params: { ids: icao.toUpperCase(), format: 'json' },
        timeout: 5000,
      });
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0] as MetarData;
      }
      return null;
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
