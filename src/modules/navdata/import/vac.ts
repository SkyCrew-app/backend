// The visual approach chart (VAC) of an aerodrome in the eAIP of the SIA,
// one folder per AIRAC cycle named after its effective date:
//   https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_01_OCT_2026/
//     Atlas-VAC/PDF_AIPparSSection/VAC/AD/AD-2.LFPN.pdf
// Checked on 2026-10-19 for AIRAC 2610: a PDF for LFPN, LFOP, LFBO, LFMT,
// LFRK, LFOX, LFPR (military), LFPF (restricted); 404 for LFOA (military),
// LFOE (restricted), LFMM and LFPS (not aerodromes), and for the folder of
// the previous cycle (eAIP_04_SEP_2026). The status of an aerodrome does
// not tell whether it has a VAC: navdata:build --check-vac asks the SIA.
// The XML SIA has no link (Ad/Cartes is empty for the 600 aerodromes).

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

export const SIA_EAIP_BASE =
  'https://www.sia.aviation-civile.gouv.fr/media/dvd';
// Where the pilot finds the charts when the VAC of an aerodrome is not
// known: the SIA home page (eAIP, VAC, SUP AIP).
export const SIA_HOME = 'https://www.sia.aviation-civile.gouv.fr/';

export const eaipFolder = (effectiveFrom: Date): string => {
  const day = String(effectiveFrom.getUTCDate()).padStart(2, '0');
  return `eAIP_${day}_${MONTHS[effectiveFrom.getUTCMonth()]}_${effectiveFrom.getUTCFullYear()}`;
};

export const vacUrl = (icao: string, effectiveFrom: Date): string =>
  `${SIA_EAIP_BASE}/${eaipFolder(effectiveFrom)}/Atlas-VAC/PDF_AIPparSSection/VAC/AD/AD-2.${icao}.pdf`;
