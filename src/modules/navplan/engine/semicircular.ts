import { normalizeDeg } from './geodesy';

// SERA.5005(g) and SERA appendix 3: above 3000 ft above the ground, VFR
// cruising levels follow the magnetic track: odd thousands + 500 ft from 000
// to 179 degrees, even thousands + 500 ft from 180 to 359. Without a terrain
// model the 3000 ft above ground condition is not checked: the suggestion is
// given from 3000 ft AMSL with the reminder that it applies above 3000 ft
// above the ground. Only a suggestion, never imposed.
export const SEMICIRCULAR_FROM_FT = 3000;

export function suggestedVfrAltitudeFt(
  magneticCourseDeg: number,
  plannedAltitudeFt: number,
): number | null {
  if (plannedAltitudeFt < SEMICIRCULAR_FROM_FT) return null;
  const eastbound = normalizeDeg(magneticCourseDeg) < 180;
  // Candidate levels: thousands of the right parity, plus 500.
  const candidates: number[] = [];
  for (let thousands = 1; thousands <= 19; thousands++) {
    if ((thousands % 2 === 1) === eastbound) {
      candidates.push(thousands * 1000 + 500);
    }
  }
  return candidates
    .filter((level) => level >= SEMICIRCULAR_FROM_FT)
    .reduce((best, level) =>
      Math.abs(level - plannedAltitudeFt) < Math.abs(best - plannedAltitudeFt)
        ? level
        : best,
    );
}
