// International Standard Atmosphere (troposphere), in the units of the
// cockpit: feet, hPa, degrees Celsius, knots.
//
// Assumptions, stated on every plan: altitudes are AMSL on the plan's QNH;
// flight levels are pressure altitudes on 1013.25 hPa; the temperature
// profile is ISA unless a forecast temperature is known.

export const STANDARD_PRESSURE_HPA = 1013.25;
const T0_K = 288.15;
const LAPSE_C_PER_FT = 1.98 / 1000;

// Height difference between the QNH and the 1013.25 hPa surfaces, ft
// (about 27-28 ft per hPa near the ground).
export const qnhCorrectionFt = (qnhHpa: number): number =>
  145366.45 * (1 - Math.pow(qnhHpa / STANDARD_PRESSURE_HPA, 0.190284));

// Pressure altitude of an altitude flown on the QNH.
export const pressureAltitudeFt = (
  altitudeFt: number,
  qnhHpa: number,
): number => altitudeFt + qnhCorrectionFt(qnhHpa);

// Altitude AMSL (on the QNH) of a flight level.
export const flightLevelToAltitudeFt = (
  flightLevel: number,
  qnhHpa: number,
): number => flightLevel * 100 - qnhCorrectionFt(qnhHpa);

export const isaTemperatureC = (pressureAltFt: number): number =>
  15 - LAPSE_C_PER_FT * pressureAltFt;

export const pressureRatio = (pressureAltFt: number): number =>
  Math.pow(1 - 6.8756e-6 * pressureAltFt, 5.2559);

export const pressureHpa = (pressureAltFt: number): number =>
  STANDARD_PRESSURE_HPA * pressureRatio(pressureAltFt);

// Pressure altitude of a pressure level (for the forecast model levels).
export const pressureAltitudeOfHpa = (hpa: number): number =>
  (1 - Math.pow(hpa / STANDARD_PRESSURE_HPA, 1 / 5.2559)) / 6.8756e-6;

export const densityRatio = (
  pressureAltFt: number,
  temperatureC: number,
): number => pressureRatio(pressureAltFt) / ((temperatureC + 273.15) / T0_K);

// True airspeed from calibrated airspeed (incompressible approximation,
// exact enough below 200 kt).
export const trueAirspeedKt = (
  casKt: number,
  pressureAltFt: number,
  temperatureC: number = isaTemperatureC(pressureAltFt),
): number => casKt / Math.sqrt(densityRatio(pressureAltFt, temperatureC));
