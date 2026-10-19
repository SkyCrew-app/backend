import { isAirbandVhf, RadioFrequency } from './airspace-intersection';
import { densityRatio, pressureAltitudeFt } from './atmosphere';
import { normalizeDeg } from './geodesy';

// What a pilot reads about the aerodromes of a plan: the AD 2 data of the
// SIA (status, hours, runways with their declared distances, frequencies,
// fuel, VAC), the frequency written on the nav log, and from the METAR the
// wind components on each runway and the density altitude.

export interface RunwayEndData {
  designator: string;
  trueBearingDeg: number | null;
  magneticBearingDeg: number | null;
  toraM: number | null;
  todaM: number | null;
  asdaM: number | null;
  ldaM: number | null;
  thresholdElevationFt: number | null;
  displacedThreshold: boolean;
  remarks: string | null;
}

export interface RunwayData {
  designator: string;
  trueHeadingDeg: number | null;
  lengthM: number | null;
  widthM: number | null;
  surface: string | null;
  main?: boolean;
  ends?: RunwayEndData[];
}

// Raw SIA texts (bilingual, with their "#" and "\\"): written out in the
// language of the request when shown.
export interface AerodromeSheet {
  icao: string;
  name: string | null;
  elevationFt: number | null;
  source: string;
  status: string | null;
  vfr: boolean | null;
  ifr: boolean | null;
  privateFlights: boolean | null;
  magneticVariationDeg: number | null;
  magneticVariationYear: string | null;
  atsHoursCode: string | null;
  atsHours: string | null;
  fuelHours: string | null;
  fuel: string | null;
  fuelRemarks: string | null;
  fuelTypes: string[];
  remarks: string | null;
  phone: string | null;
  operator: string | null;
  runways: RunwayData[];
  frequencies: RadioFrequency[];
  // The VAC of the cycle (null: none known); chartsUrl: the SIA site.
  vacUrl: string | null;
  chartsUrl: string;
}

// ---------- Nav log frequency ----------

// Services a pilot calls to take off or land, in this order. GND, DEL,
// APP, FIS, VDF (direction finding) and the auxiliary (Suppletive) ones
// are not the frequency of the circuit.
const CIRCUIT_SERVICES = ['TWR', 'AFIS', 'A/A'];

const firstUsable = (frequencies: RadioFrequency[], service: string) => {
  const of = frequencies.filter(
    (f) => f.service === service && isAirbandVhf(f.mhz),
  );
  return of.find((f) => !f.auxiliary) ?? of[0] ?? null;
};

// The frequencies printed on the nav log line of an aerodrome:
//   - the tower, else the AFIS, else the A/A (air-to-air, no ATS);
//   - with a tower or an AFIS whose hours are not H24, the A/A as well:
//     the SIA gives the ATS hours as free text ("TWR : 0600-2100.", "HO",
//     often local time with summer shifts), so the plan cannot tell which
//     applies at the time of the flight; both are printed, briefly
//     ("TWR / A/A 120.200" when they share the frequency, as at LFOP), and
//     the aerodrome sheet gives the hours;
//   - the ground frequency on the departure line, the ATIS on the
//     departure and the destination lines.
export function navLogFrequency(
  sheet: Pick<AerodromeSheet, 'frequencies' | 'atsHoursCode'>,
  role: 'departure' | 'destination' | 'alternate' | 'enroute',
): string | null {
  const frequencies = sheet.frequencies ?? [];
  const parts: string[] = [];
  const atsH24 = (sheet.atsHoursCode ?? '').toUpperCase() === 'H24';
  const ats =
    firstUsable(frequencies, 'TWR') ?? firstUsable(frequencies, 'AFIS');
  const airToAir = firstUsable(frequencies, 'A/A');
  if (ats && airToAir && !atsH24) {
    parts.push(
      ats.mhz === airToAir.mhz
        ? `${ats.service} / A/A ${ats.mhz}`
        : `${ats.service} ${ats.mhz} / A/A ${airToAir.mhz}`,
    );
  } else if (ats) {
    parts.push(`${ats.service} ${ats.mhz}`);
  } else if (airToAir) {
    parts.push(`A/A ${airToAir.mhz}`);
  }
  if (role === 'departure') {
    const ground = firstUsable(frequencies, 'GND');
    if (ground) parts.push(`GND ${ground.mhz}`);
  }
  if (role === 'departure' || role === 'destination') {
    const atis =
      firstUsable(frequencies, 'ATIS') ?? firstUsable(frequencies, 'D-ATIS');
    if (atis) parts.push(`ATIS ${atis.mhz}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export const isCircuitService = (service: string) =>
  CIRCUIT_SERVICES.includes(service);

// ---------- METAR ----------

export interface MetarData {
  // True direction the wind blows from; null when variable (VRB) or calm.
  windDirectionDeg: number | null;
  windSpeedKt: number | null;
  gustKt: number | null;
  variable: boolean;
  temperatureC: number | null;
  dewpointC: number | null;
  qnhHpa: number | null;
}

const MPS_TO_KT = 3600 / 1852;

// The groups of a METAR used for the runway wind and the density altitude:
// "27015G25KT", "VRB03KT", "00000KT", "24008MPS"; "12/M02"; "Q1013" or
// "A2992". Anything else is ignored; a missing group gives null.
export function decodeMetar(raw: string | null | undefined): MetarData {
  const data: MetarData = {
    windDirectionDeg: null,
    windSpeedKt: null,
    gustKt: null,
    variable: false,
    temperatureC: null,
    dewpointC: null,
    qnhHpa: null,
  };
  if (!raw) return data;
  // The trend and the remarks may repeat groups: only the body is read.
  const body = raw.split(/\s(?:TEMPO|BECMG|NOSIG|RMK)\b/)[0];
  const wind = /\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/.exec(body);
  if (wind) {
    const factor = wind[4] === 'MPS' ? MPS_TO_KT : 1;
    data.windSpeedKt = Math.round(Number(wind[2]) * factor);
    data.gustKt = wind[3] ? Math.round(Number(wind[3]) * factor) : null;
    data.variable = wind[1] === 'VRB';
    data.windDirectionDeg =
      wind[1] === 'VRB' || data.windSpeedKt === 0 ? null : Number(wind[1]);
  }
  const temperature = /\s(M?\d{2})\/(M?\d{2})?(?=\s|$)/.exec(body);
  if (temperature) {
    const value = (t: string) =>
      t.startsWith('M') ? -Number(t.slice(1)) : Number(t);
    data.temperatureC = value(temperature[1]);
    data.dewpointC = temperature[2] ? value(temperature[2]) : null;
  }
  const qnh = /\bQ(\d{4})\b/.exec(body);
  const altimeter = /\bA(\d{4})\b/.exec(body);
  if (qnh) data.qnhHpa = Number(qnh[1]);
  else if (altimeter)
    data.qnhHpa = Math.round((Number(altimeter[1]) / 100) * 33.8639);
  return data;
}

// ---------- Runway wind and density altitude ----------

export interface RunwayWind {
  designator: string;
  // Positive head wind, negative tail wind, kt.
  headwindKt: number;
  // Positive from the right, negative from the left, kt.
  crosswindKt: number;
  gustHeadwindKt: number | null;
  gustCrosswindKt: number | null;
  // The direction most into the wind (for each runway, with the least
  // cross wind when several are equal).
  best: boolean;
}

export interface AerodromeConditions {
  station: string;
  observedAt: Date | null;
  metar: MetarData;
  pressureAltitudeFt: number | null;
  densityAltitudeFt: number | null;
  runways: RunwayWind[];
}

// The true bearing of a runway direction: published (AIXM, XML SIA), else
// from its number (magnetic, tens of degrees) and the variation.
const trueBearingOf = (
  end: RunwayEndData,
  magneticVariationDeg: number | null,
): number | null => {
  if (end.trueBearingDeg !== null) return end.trueBearingDeg;
  if (end.magneticBearingDeg !== null)
    return normalizeDeg(end.magneticBearingDeg + (magneticVariationDeg ?? 0));
  const number = /^(\d{2})/.exec(end.designator)?.[1];
  return number
    ? normalizeDeg(Number(number) * 10 + (magneticVariationDeg ?? 0))
    : null;
};

// The directions of a runway; a runway imported without them (OurAirports,
// a cycle built before the declared distances) has its designator ("07/25")
// and the true heading of its first direction.
export function runwayEndsOf(runway: RunwayData): RunwayEndData[] {
  if (runway.ends?.length) return runway.ends;
  return runway.designator
    .split('/')
    .slice(0, 2)
    .map((designator, i) => ({
      designator: designator.trim(),
      trueBearingDeg:
        runway.trueHeadingDeg === null
          ? null
          : normalizeDeg(runway.trueHeadingDeg + i * 180),
      magneticBearingDeg: null,
      toraM: null,
      todaM: null,
      asdaM: null,
      ldaM: null,
      thresholdElevationFt: null,
      displacedThreshold: false,
      remarks: null,
    }));
}

export function runwayWinds(
  runways: RunwayData[],
  metar: MetarData,
  magneticVariationDeg: number | null,
): RunwayWind[] {
  if (metar.windDirectionDeg === null || metar.windSpeedKt === null) return [];
  const winds: RunwayWind[] = [];
  for (const runway of runways) {
    for (const end of runwayEndsOf(runway)) {
      const bearing = trueBearingOf(end, magneticVariationDeg);
      if (bearing === null) continue;
      const angle = ((metar.windDirectionDeg - bearing) * Math.PI) / 180;
      const round = (value: number) => Math.round(value) || 0;
      winds.push({
        designator: end.designator,
        headwindKt: round(metar.windSpeedKt * Math.cos(angle)),
        crosswindKt: round(metar.windSpeedKt * Math.sin(angle)),
        gustHeadwindKt:
          metar.gustKt === null ? null : round(metar.gustKt * Math.cos(angle)),
        gustCrosswindKt:
          metar.gustKt === null ? null : round(metar.gustKt * Math.sin(angle)),
        best: false,
      });
    }
  }
  // Parallel runways get the same components: the main one, else the
  // longest, is suggested (LFMT 30R, 2600 m, rather than 30L, 1100 m).
  const rank = new Map<RunwayWind, { main: number; length: number }>();
  let i = 0;
  for (const runway of runways)
    for (const end of runwayEndsOf(runway)) {
      if (trueBearingOf(end, magneticVariationDeg) === null) continue;
      rank.set(winds[i++], {
        main: runway.main ? 1 : 0,
        length: runway.lengthM ?? 0,
      });
    }
  const best = [...winds].sort(
    (a, b) =>
      b.headwindKt - a.headwindKt ||
      Math.abs(a.crosswindKt) - Math.abs(b.crosswindKt) ||
      rank.get(b)!.main - rank.get(a)!.main ||
      rank.get(b)!.length - rank.get(a)!.length,
  )[0];
  if (best) best.best = true;
  return winds;
}

// Altitude in the standard atmosphere with the same air density: from the
// pressure altitude (elevation on the METAR QNH) and the temperature.
export function densityAltitudeFt(
  pressureAltFt: number,
  temperatureC: number,
): number {
  const sigma = densityRatio(pressureAltFt, temperatureC);
  return (1 - Math.pow(sigma, 1 / 4.2559)) / 6.8756e-6;
}

export function aerodromeConditions(
  sheet: Pick<AerodromeSheet, 'runways' | 'magneticVariationDeg'> & {
    icao: string;
    elevationFt: number | null;
  },
  report: { metar: string | null; observedAt: Date | null } | null,
): AerodromeConditions | null {
  if (!report?.metar) return null;
  const metar = decodeMetar(report.metar);
  const pressureAlt =
    sheet.elevationFt !== null && metar.qnhHpa !== null
      ? pressureAltitudeFt(sheet.elevationFt, metar.qnhHpa)
      : null;
  return {
    station: sheet.icao,
    observedAt: report.observedAt,
    metar,
    pressureAltitudeFt: pressureAlt === null ? null : Math.round(pressureAlt),
    densityAltitudeFt:
      pressureAlt !== null && metar.temperatureC !== null
        ? Math.round(densityAltitudeFt(pressureAlt, metar.temperatureC))
        : null,
    runways: runwayWinds(
      sheet.runways,
      metar,
      sheet.magneticVariationDeg ?? null,
    ),
  };
}
