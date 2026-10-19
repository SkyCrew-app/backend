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

// The part of a bilingual SIA text in one language: the French version
// comes first, the English one after "\\" ("0600-2000.#Extension possible
// jusqu'à 2100 sur PN de 4 HR\\0600-2000#Possible extension until 2100 PN
// 4 HR." for the fuel hours of LFPN). A text in one language only is the
// same in both. Lines as in siaText. Applied to the raw text: once cleaned,
// the versions cannot be told apart.
export function siaInLanguage(
  text: string | null | undefined,
  language: 'fr' | 'en',
): string | null {
  if (text == null) return null;
  const parts = text
    .split(/\\{2}/)
    .map((part) => siaText(part))
    .filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return language === 'en' && parts.length > 1 ? parts[1] : parts[0];
}
