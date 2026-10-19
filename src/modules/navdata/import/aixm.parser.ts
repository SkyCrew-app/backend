import { BundlePoint, bump, ImportReport } from './bundle-types';
import { child, childText, walkXml, XmlElement } from './xml';

// Reads what the "XML SIA" file lacks from the AIXM 4.5 file of the same
// zip (AIXM4.5_all_FR_OM_yyyy-mm-dd.xml): per runway direction (Rdn), the
// magnetic bearing (valMagBrg, the QFU) and the declared distances (Rdd:
// TORA, TODA, ASDA, LDA). Both are identified by the aerodrome (AhpUid/
// codeId), the runway ("07R/25L") and the direction ("07R"):
//   <Rdn><RdnUid><RwyUid><AhpUid><codeId>LFPN</codeId></AhpUid>
//     <txtDesig>07L/25R</txtDesig></RwyUid><txtDesig>07L</txtDesig></RdnUid>
//     <valTrueBrg>071.23</valTrueBrg><valMagBrg>069</valMagBrg>...</Rdn>
//   <Rdd><RddUid><RdnUid>(same)</RdnUid><codeType>TORA</codeType>
//     <codeDayPeriod>OTHER</codeDayPeriod></RddUid>
//     (an Rdd with a TwyUid is from an intersection: left out)
//     <valDist>1100</valDist><uomDist>M</uomDist></Rdd>

export interface AixmRunwayEnd {
  trueBearingDeg: number | null;
  magneticBearingDeg: number | null;
  toraM: number | null;
  todaM: number | null;
  asdaM: number | null;
  ldaM: number | null;
}

const DISTANCES = { TORA: 'toraM', TODA: 'todaM', ASDA: 'asdaM', LDA: 'ldaM' };

const numberOf = (text: string | null): number | null => {
  if (text === null) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

const endKey = (icao: string, runway: string, end: string) =>
  `${icao}|${runway}|${end}`;

// "LFPN|07L/25R|07L" of an RdnUid.
const keyOfRdnUid = (rdnUid: XmlElement | undefined): string | null => {
  if (!rdnUid) return null;
  const rwyUid = child(rdnUid, 'RwyUid');
  const ahpUid = rwyUid && child(rwyUid, 'AhpUid');
  const icao = ahpUid && childText(ahpUid, 'codeId');
  const runway = rwyUid && childText(rwyUid, 'txtDesig');
  const end = childText(rdnUid, 'txtDesig');
  return icao && runway && end ? endKey(icao, runway, end) : null;
};

const metres = (value: number | null, unit: string | null) =>
  value === null
    ? null
    : unit === 'FT'
      ? Math.round(value * 0.3048)
      : Math.round(value);

export function parseAixmRunwayEnds(xml: string): Map<string, AixmRunwayEnd> {
  const ends = new Map<string, AixmRunwayEnd>();
  const endOf = (key: string) => {
    let end = ends.get(key);
    if (!end) {
      end = {
        trueBearingDeg: null,
        magneticBearingDeg: null,
        toraM: null,
        todaM: null,
        asdaM: null,
        ldaM: null,
      };
      ends.set(key, end);
    }
    return end;
  };
  walkXml(xml, 1, (element) => {
    if (element.name === 'Rdn') {
      const key = keyOfRdnUid(child(element, 'RdnUid'));
      if (!key) return;
      const end = endOf(key);
      end.trueBearingDeg = numberOf(childText(element, 'valTrueBrg'));
      end.magneticBearingDeg = numberOf(childText(element, 'valMagBrg'));
    } else if (element.name === 'Rdd') {
      const rddUid = child(element, 'RddUid');
      const key = keyOfRdnUid(rddUid && child(rddUid, 'RdnUid'));
      const type = rddUid && childText(rddUid, 'codeType');
      // Distances of the day or the night only (codeDayPeriod D / N) are
      // left out; OTHER (7081 in AIRAC 2610) and A (all day) always apply.
      const period = rddUid && childText(rddUid, 'codeDayPeriod');
      if (!key || !type || !(type in DISTANCES)) return;
      // From an intersection (TwyUid: "16 via A3" at LFLY, 940 m): not the
      // distance of the runway.
      if (rddUid && child(rddUid, 'TwyUid')) return;
      if (period && period !== 'OTHER' && period !== 'A') return;
      endOf(key)[DISTANCES[type as keyof typeof DISTANCES]] = metres(
        numberOf(childText(element, 'valDist')),
        childText(element, 'uomDist'),
      );
    }
  });
  return ends;
}

// Completes the runway directions of the SIA aerodromes with the AIXM
// values; the XML SIA LDA stays when the AIXM file has none.
export function mergeAixmRunwayEnds(
  points: BundlePoint[],
  ends: Map<string, AixmRunwayEnd>,
  report: ImportReport,
): void {
  for (const point of points) {
    if (point.type !== 'AERODROME' || point.source !== 'SIA') continue;
    for (const runway of point.extra?.runways ?? []) {
      for (const end of runway.ends ?? []) {
        const aixm = ends.get(
          endKey(point.ident, runway.designator, end.designator),
        );
        if (!aixm) continue;
        end.trueBearingDeg = aixm.trueBearingDeg ?? end.trueBearingDeg;
        end.magneticBearingDeg = aixm.magneticBearingDeg;
        end.toraM = aixm.toraM;
        end.todaM = aixm.todaM;
        end.asdaM = aixm.asdaM;
        end.ldaM = aixm.ldaM ?? end.ldaM;
        bump(report.counts, 'runway directions with AIXM distances');
      }
    }
  }
}
