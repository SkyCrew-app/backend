import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AircraftPerformanceProfile } from './interfaces/performance.interface';

interface PerformanceData {
  profiles: Record<string, AircraftPerformanceProfile>;
  default: AircraftPerformanceProfile;
}

@Injectable()
export class AircraftPerformanceService implements OnModuleInit {
  private readonly logger = new Logger(AircraftPerformanceService.name);
  private data: PerformanceData;

  onModuleInit(): void {
    const paths = [
      join(__dirname, 'data', 'aircraft-performance.json'),
      join(
        process.cwd(),
        'src',
        'modules',
        'flights',
        'data',
        'aircraft-performance.json',
      ),
    ];

    const filePath = paths.find((p) => existsSync(p));
    if (!filePath) {
      this.logger.warn(
        'aircraft-performance.json not found, using built-in defaults',
      );
      this.data = { profiles: {}, default: this.builtInDefault() };
      return;
    }

    this.data = JSON.parse(readFileSync(filePath, 'utf-8'));
    this.logger.log(
      `Loaded ${Object.keys(this.data.profiles).length} aircraft performance profiles`,
    );
  }

  /**
   * Get performance profile for an aircraft model.
   * Tries exact match first, then fuzzy (case-insensitive substring) match.
   * Falls back to the default profile if no match is found,
   * with cruise/fuel overridden from actual aircraft entity values.
   */
  getProfile(
    model: string,
    fallbackCruiseKmh?: number,
    fallbackConsumptionLph?: number,
  ): AircraftPerformanceProfile {
    // Exact match
    if (this.data.profiles[model]) {
      return this.data.profiles[model];
    }

    // Fuzzy match: case-insensitive substring
    const modelLower = model.toLowerCase();
    for (const [key, profile] of Object.entries(this.data.profiles)) {
      if (
        key.toLowerCase().includes(modelLower) ||
        modelLower.includes(key.toLowerCase())
      ) {
        return profile;
      }
    }

    // ICAO type match
    for (const [, profile] of Object.entries(this.data.profiles)) {
      if (profile.icao_type.toLowerCase() === modelLower) {
        return profile;
      }
    }

    // Fallback: default profile, adjusted with actual aircraft values
    const defaultProfile = { ...this.data.default };
    if (fallbackCruiseKmh) {
      defaultProfile.cruise = {
        ...defaultProfile.cruise,
        tas_kts: Math.round(fallbackCruiseKmh * 0.539957),
      };
    }
    if (fallbackConsumptionLph) {
      defaultProfile.cruise = {
        ...defaultProfile.cruise,
        fuel_lph: fallbackConsumptionLph,
      };
      // Scale other phases relative to cruise
      const ratio = fallbackConsumptionLph / this.data.default.cruise.fuel_lph;
      defaultProfile.climb = {
        ...defaultProfile.climb,
        fuel_lph: Math.round(defaultProfile.climb.fuel_lph * ratio),
      };
      defaultProfile.descent = {
        ...defaultProfile.descent,
        fuel_lph: Math.round(defaultProfile.descent.fuel_lph * ratio),
      };
      defaultProfile.approach = {
        ...defaultProfile.approach,
        fuel_lph: Math.round(defaultProfile.approach.fuel_lph * ratio),
      };
    }
    return defaultProfile;
  }

  private builtInDefault(): AircraftPerformanceProfile {
    return {
      icao_type: 'ZZZZ',
      category: 'SEP',
      climb: { rate_fpm: 700, ias_kts: 75, fuel_lph: 35 },
      cruise: { tas_kts: 120, fuel_lph: 30, ceiling_ft: 14000 },
      descent: { rate_fpm: 500, ias_kts: 100, fuel_lph: 18 },
      approach: { ias_kts: 65, vref_kts: 60, fuel_lph: 22 },
      taxi_fuel_liters: 5,
      usable_fuel_liters: 180,
      max_range_nm: 500,
    };
  }
}
