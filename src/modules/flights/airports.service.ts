import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';
import { Buffer } from 'buffer';

@Injectable()
export class AirportsService {
  private readonly logger = new Logger(AirportsService.name);
  private readonly FPDB_BASE_URL = 'https://api.flightplandatabase.com';
  private readonly FPDB_API_KEY = process.env.FPDB_API_KEY;

  private readonly criticalAirports: string[] = [
    'LFPG',
    'LFBO',
    'KJFK',
    'EGLL',
  ];

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly httpService: HttpService,
  ) {}

  async getAirportInfo(icao: string): Promise<any> {
    const cacheKey = `airport:${icao}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit pour ${icao}`);
      return cached;
    }
    this.logger.debug(`Cache miss pour ${icao}`);

    try {
      const data = await this.fetchAirportInfo(icao);
      data.lastUpdated = new Date();
      await this.cacheManager.set(cacheKey, data);
      return data;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: unknown) {
      this.logger.error(
        `Erreur lors de la récupération des infos pour ${icao}`,
      );
      throw new Error(`Impossible de récupérer les données pour ${icao}`);
    }
  }

  async fetchAirportInfo(icao: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.FPDB_BASE_URL}/nav/airport/${icao}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.FPDB_API_KEY}:`).toString('base64')}`,
          },
          timeout: 500000,
          validateStatus: (status) => status >= 200 && status < 500,
        },
      );
      const data = response.data;
      const lat = data.lat || data.latitude || null;
      const lon = data.lon || data.longitude || null;
      if (lat === null || lon === null) {
        throw new Error(`Coordonnées non disponibles pour l'aéroport ${icao}`);
      }
      return data;
    } catch (error: any) {
      console.error(`Échec de fetchAirportInfo pour ${icao}: ${error.message}`);
      throw new Error(`Impossible de récupérer les données pour ${icao}`);
    }
  }

  @Cron('0 0 1 * *')
  async refreshCriticalAirports(): Promise<void> {
    this.logger.log('Rafraîchissement mensuel des aéroports critiques...');
    for (const icao of this.criticalAirports) {
      try {
        const data = await this.fetchAirportInfo(icao);
        console.log(data);
        data.lastUpdated = new Date();
        const cacheKey = `airport:${icao}`;
        await this.cacheManager.set(cacheKey, data);
        this.logger.log(
          `Données écrites dans Redis : clé=${cacheKey}, valeur=${JSON.stringify(data)}`,
        );

        console.log(await this.cacheManager.get(cacheKey));

        this.logger.log(`Mise à jour du cache pour ${icao}`);
      } catch (error: any) {
        this.logger.warn(
          `Échec de rafraîchissement pour ${icao}: ${error.message}`,
        );
      }
    }
  }
}
