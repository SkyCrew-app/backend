// AIRAC cycles: 28 days each. Reference: AIRAC 2601 effective 2026-01-22
// (so 2610 on 2026-10-01 and 2611 on 2026-10-29, as the SIA announces).
// The identifier is the year (2 digits) and the rank of the cycle among
// those that start in that year (13 or 14 a year).

const DAY_MS = 86_400_000;
const CYCLE_DAYS = 28;
const REFERENCE = Date.UTC(2026, 0, 22);

export interface AiracCycle {
  ident: string; // "2611"
  effectiveFrom: Date;
  effectiveTo: Date; // exclusive: start of the next cycle
}

const cycleIndexOf = (date: Date): number =>
  Math.floor((date.getTime() - REFERENCE) / (CYCLE_DAYS * DAY_MS));

const startOf = (index: number): Date =>
  new Date(REFERENCE + index * CYCLE_DAYS * DAY_MS);

function identOf(index: number): string {
  const start = startOf(index);
  const year = start.getUTCFullYear();
  let rank = 1;
  for (let i = index - 1; startOf(i).getUTCFullYear() === year; i--) rank++;
  return `${String(year % 100).padStart(2, '0')}${String(rank).padStart(2, '0')}`;
}

const cycleAtIndex = (index: number): AiracCycle => ({
  ident: identOf(index),
  effectiveFrom: startOf(index),
  effectiveTo: startOf(index + 1),
});

export const airacCycleAt = (date: Date): AiracCycle =>
  cycleAtIndex(cycleIndexOf(date));

export const nextAiracCycle = (date: Date): AiracCycle =>
  cycleAtIndex(cycleIndexOf(date) + 1);

export function airacCycleByIdent(ident: string): AiracCycle | null {
  if (!/^\d{4}$/.test(ident)) return null;
  const year = 2000 + Number(ident.slice(0, 2));
  const rank = Number(ident.slice(2));
  // First cycle starting in that year.
  let index = cycleIndexOf(new Date(Date.UTC(year, 0, 1)));
  if (startOf(index).getUTCFullYear() < year) index++;
  const cycle = cycleAtIndex(index + rank - 1);
  return cycle.effectiveFrom.getUTCFullYear() === year ? cycle : null;
}

// How many cycles have started since the given cycle began, at `now`
// (0: still in force).
export const cyclesBehind = (effectiveFrom: Date, now: Date): number =>
  Math.max(0, cycleIndexOf(now) - cycleIndexOf(effectiveFrom));
