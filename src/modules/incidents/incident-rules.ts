// How serious an incident is, whatever spelling it was recorded with: the
// close-flight form sends the codes, older data holds French words.
export type IncidentLevel = 'low' | 'medium' | 'high';

const LEVEL_ALIASES: Record<IncidentLevel, string[]> = {
  low: ['low', 'faible', 'basse', 'bas', 'mineur', 'mineure', 'minor'],
  medium: ['medium', 'moyen', 'moyenne', 'modere', 'moderee', 'moderate'],
  high: [
    'high',
    'eleve',
    'elevee',
    'haut',
    'haute',
    'grave',
    'critique',
    'critical',
    'majeur',
    'majeure',
    'major',
    'severe',
  ],
};

const normalise = (value: string | null | undefined): string =>
  (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const incidentLevel = (
  value: string | null | undefined,
): IncidentLevel | null => {
  const key = normalise(value);
  const levels = Object.keys(LEVEL_ALIASES) as IncidentLevel[];
  return levels.find((level) => LEVEL_ALIASES[level].includes(key)) ?? null;
};

// Severity levels that take the aircraft out of service as soon as the
// incident is reported. It stays grounded until an administrator or a
// technician puts it back.
export const GROUNDING_SEVERITIES: IncidentLevel[] = ['high'];

export const groundsAircraft = (
  severity: string | null | undefined,
): boolean => {
  const level = incidentLevel(severity);
  return level !== null && GROUNDING_SEVERITIES.includes(level);
};
