// Free text of the SIA export (Activite, HorTxt, Remarque): "#" ends a line
// and "\\" (two backslashes) opens the English version after the French
// one, as in "Procédures d'aérodromes#\\Aerodrome procedures"; lines may
// also end with CR LF. Turned into plain lines, the French ones first:
// "Procédures d'aérodromes\nAerodrome procedures". Idempotent: also applied
// when reading a cycle imported before this cleaning.
export function siaText(text: string | null | undefined): string | null {
  if (text == null) return null;
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/#/g, '\n')
    .replace(/\\{2}/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines.join('\n') : null;
}
