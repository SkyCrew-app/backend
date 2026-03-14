import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AirportData } from './interfaces/airport.interface';

@Injectable()
export class AirportsService implements OnModuleInit {
  private readonly logger = new Logger(AirportsService.name);
  private readonly airportsByIcao = new Map<string, AirportData>();

  onModuleInit(): void {
    const possiblePaths = [
      join(__dirname, 'data', 'airports.json'),
      join(
        __dirname,
        '..',
        '..',
        'modules',
        'flights',
        'data',
        'airports.json',
      ),
      join(process.cwd(), 'src', 'modules', 'flights', 'data', 'airports.json'),
    ];

    const filePath = possiblePaths.find((path) => existsSync(path));
    if (!filePath) {
      throw new Error('airports.json not found');
    }

    const parsedData = JSON.parse(
      readFileSync(filePath, 'utf-8'),
    ) as AirportData[];
    parsedData.forEach((airport) => {
      this.airportsByIcao.set(airport.icao.toUpperCase(), airport);
    });

    this.logger.log(
      `Loaded ${this.airportsByIcao.size} airports from local DB`,
    );
  }

  getAirportInfo(icao: string): AirportData {
    return this.fetchAirportInfo(icao);
  }

  fetchAirportInfo(icao: string): AirportData {
    const normalizedIcao = icao.toUpperCase();
    const data = this.airportsByIcao.get(normalizedIcao);

    if (!data) {
      throw new NotFoundException(
        `Aéroport introuvable pour le code ${normalizedIcao}`,
      );
    }

    return data;
  }
}
