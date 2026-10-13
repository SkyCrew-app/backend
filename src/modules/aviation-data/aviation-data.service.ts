import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Aerodrome } from './entity/aerodrome.entity';
import { AerodromeWeather } from './entity/aerodrome-weather.entity';

const API_URL = 'https://api.api-ninjas.com/v1';
const REQUEST_TIMEOUT_MS = 5000;

const AERODROME_TTL_MS = 24 * 60 * 60 * 1000;
const WEATHER_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_SEARCH_RESULTS = 20;

const ICAO = /^[A-Za-z]{4}$/;
const IATA = /^[A-Za-z]{3}$/;

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const numberOf = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// The provider gives the wind in metres per second; the application shows
// kilometres per hour.
const kmhFromMetresPerSecond = (value: number | undefined) =>
  value === undefined ? undefined : Math.round(value * 3.6 * 10) / 10;

// An IANA name the browser can format a time with ("Europe/Paris").
const timeZoneOf = (value: unknown): string | undefined => {
  const name = text(value);
  if (!name) {
    return undefined;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: name });
    return name;
  } catch {
    return undefined;
  }
};

// Aerodrome directory and weather, read from API Ninjas. The key stays on
// the server: the browser only ever talks to this API. The service is
// optional: without API_NINJAS_KEY the lookups answer "nothing found".
@Injectable()
export class AviationDataService {
  private readonly logger = new Logger(AviationDataService.name);
  private readonly cache = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();
  private warnedAboutMissingKey = false;

  async aerodromeByIcao(icao: string): Promise<Aerodrome | null> {
    const code = icao.trim().toUpperCase();
    if (!ICAO.test(code)) {
      return null;
    }
    return (await this.aerodromes({ icao: code }))[0] ?? null;
  }

  async aerodromeByIata(iata: string): Promise<Aerodrome | null> {
    const code = iata.trim().toUpperCase();
    if (!IATA.test(code)) {
      return null;
    }
    return (await this.aerodromes({ iata: code }))[0] ?? null;
  }

  // What the aerodrome picker needs: an exact code first, then the names.
  async searchAerodromes(query: string): Promise<Aerodrome[]> {
    const term = query.trim();
    if (term.length < 2 || term.length > 50) {
      return [];
    }

    const lookups: Promise<Aerodrome[]>[] = [];
    if (ICAO.test(term)) {
      lookups.push(this.aerodromes({ icao: term.toUpperCase() }));
    } else if (IATA.test(term)) {
      lookups.push(this.aerodromes({ iata: term.toUpperCase() }));
    }
    lookups.push(this.aerodromes({ name: term.toLowerCase() }));

    const seen = new Set<string>();
    return (await Promise.all(lookups))
      .flat()
      .filter((aerodrome) => {
        const key = aerodrome.icao ?? aerodrome.iata ?? aerodrome.name;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, MAX_SEARCH_RESULTS);
  }

  async weatherAt(
    latitude: number,
    longitude: number,
  ): Promise<AerodromeWeather | null> {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return null;
    }

    // About a kilometre: close positions share one cached answer.
    const params = { lat: latitude.toFixed(2), lon: longitude.toFixed(2) };
    const data = await this.fetch<Record<string, unknown>>(
      'weather',
      params,
      WEATHER_TTL_MS,
    );
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }

    return {
      temperature: numberOf(data.temp),
      feelsLike: numberOf(data.feels_like),
      humidity: numberOf(data.humidity),
      cloudCover: numberOf(data.cloud_pct),
      windSpeed: numberOf(data.wind_speed),
      windSpeedKmh: kmhFromMetresPerSecond(numberOf(data.wind_speed)),
      windDegrees: numberOf(data.wind_degrees),
      sunrise: numberOf(data.sunrise),
      sunset: numberOf(data.sunset),
    };
  }

  private async aerodromes(
    params: Record<string, string>,
  ): Promise<Aerodrome[]> {
    const data = await this.fetch<unknown[]>(
      'airports',
      params,
      AERODROME_TTL_MS,
    );
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter(
        (entry): entry is Record<string, unknown> =>
          !!entry &&
          typeof entry === 'object' &&
          !!text((entry as Record<string, unknown>).name),
      )
      .map((entry) => ({
        icao: text(entry.icao),
        iata: text(entry.iata),
        name: text(entry.name),
        city: text(entry.city),
        country: text(entry.country),
        latitude: numberOf(entry.latitude),
        longitude: numberOf(entry.longitude),
        timezone: timeZoneOf(entry.timezone),
      }));
  }

  // One upstream call, answered from memory while the previous answer is
  // fresh. Failures are not cached and never reach the caller as an error.
  private async fetch<T>(
    endpoint: 'airports' | 'weather',
    params: Record<string, string>,
    ttl: number,
  ): Promise<T | null> {
    const apiKey = process.env.API_NINJAS_KEY;
    if (!apiKey) {
      if (!this.warnedAboutMissingKey) {
        this.warnedAboutMissingKey = true;
        this.logger.warn(
          'Aerodrome lookup and weather are disabled: API_NINJAS_KEY is not set',
        );
      }
      return null;
    }

    const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    try {
      const response = await axios.get(`${API_URL}/${endpoint}`, {
        params,
        headers: { 'X-Api-Key': apiKey },
        timeout: REQUEST_TIMEOUT_MS,
      });
      this.remember(cacheKey, response.data, ttl);
      return response.data as T;
    } catch (error) {
      // The message only: the request, and so the key, is never logged.
      this.logger.warn(
        `API Ninjas ${endpoint} unavailable: ${error?.message ?? 'unknown error'}`,
      );
      return null;
    }
  }

  private remember(key: string, value: unknown, ttl: number): void {
    this.cache.delete(key);
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      // A Map iterates in insertion order: the first key is the oldest.
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
  }
}
