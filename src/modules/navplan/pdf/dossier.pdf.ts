import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import { Language } from '../../../common/i18n/languages';
import { renderTranslation } from '../../../common/i18n/translate';
import { TranslationKey } from '../../../common/i18n/fr';
import {
  FlightPlanResult,
  LegResult,
  TAXI_OUT_MINUTES,
} from '../engine/engine';
import { utcTime } from '../engine/conditions';
import { renderMessage } from '../render';
import { altitudeLimitLabel } from '../engine/airspace-intersection';
import { pointLabel } from '../engine/point-label';
import { navLogFrequency } from '../engine/aerodrome';
import { renderSheet } from '../../navdata/navdata.service';
import { embedDossierFonts } from './truetype-font';
import { AerodromeDistances } from '../engine/runway-distances';

// The flight file: navigation log, fuel, mass and balance with the envelope,
// airspaces crossed, raw weather, warnings and the mandatory notices. A4
// portrait: the whole file; A5 landscape: the kneeboard navigation log with
// the fuel summary and warnings. The fonts are embedded (Liberation Sans,
// WinAnsi encoding: French accents, degree sign); other symbols are
// replaced.

export interface DossierOptions {
  result: FlightPlanResult;
  format: 'A4' | 'A5';
  language: Language;
  pilot: string;
  aircraft: string;
  weighingDate: Date | string | null;
}

const REPLACEMENTS: [RegExp, string][] = [
  [/≠/g, '!='],
  [/≤/g, '<='],
  [/≥/g, '>='],
  [/→/g, '->'],
  [/≈/g, '~'],
  [/ | /g, ' '],
];
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

/**
 * What the airspace section says when it lists nothing: without airspace data
 * the route was not checked, which is never "no airspace crossed".
 */
export const emptyAirspacesKey = (notices: { code: string }[]) =>
  notices.some((notice) => notice.code === 'NAVDATA_NO_AIRSPACE')
    ? ('navplan.pdf.airspaces.notChecked' as const)
    : ('navplan.pdf.airspaces.none' as const);

/** A chart label goes under its point when an earlier label sits close by. */
export const labelBelow = (
  earlier: [number, number][],
  [x, y]: [number, number],
): boolean =>
  earlier.some(([ox, oy]) => Math.abs(ox - x) < 30 && Math.abs(oy - y) < 8);

export const printable = (text: string): string => {
  let value = String(text ?? '');
  for (const [pattern, replacement] of REPLACEMENTS)
    value = value.replace(pattern, replacement);
  return [...value]
    .map((c) => {
      const code = c.charCodeAt(0);
      if (c === '\n') return ' ';
      if (
        (code >= 0x20 && code <= 0x7e) ||
        (code >= 0xa0 && code <= 0xff) ||
        WIN_ANSI_EXTRA.includes(c)
      )
        return c;
      return '?';
    })
    .join('');
};

const t = (
  language: Language,
  key: string,
  params?: Record<string, string | number>,
) => printable(renderTranslation(language, key as TranslationKey, params));

const deg = (value: number) =>
  String(Math.round(((value % 360) + 360) % 360) % 360).padStart(3, '0');
const one = (value: number) => (Math.round(value * 10) / 10).toFixed(1);
const minutes = (value: number) => {
  const total = Math.round(value);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
};
const hhmm = (value: Date | string) =>
  new Date(value).toISOString().slice(11, 16);

const RED = rgb(0.75, 0.1, 0.1);
const ORANGE = rgb(0.85, 0.45, 0);
const GREEN = rgb(0.1, 0.5, 0.2);
const GREY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0, 0, 0);

class Writer {
  page: PDFPage;
  y: number;
  pageNumber = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly size: [number, number],
    readonly font: PDFFont,
    readonly bold: PDFFont,
    readonly margin: number,
    readonly footer: string,
    readonly language: Language,
  ) {
    this.newPage();
  }

  get width() {
    return this.size[0] - 2 * this.margin;
  }

  newPage() {
    this.page = this.doc.addPage(this.size);
    this.pageNumber++;
    this.y = this.size[1] - this.margin;
    const footer = `${this.footer} — ${t(this.language, 'navplan.pdf.page', { page: this.pageNumber })}`;
    this.wrap(footer, 5.5, this.size[0] - 2 * this.margin).forEach((line, i) =>
      this.page.drawText(line, {
        x: this.margin,
        y: this.margin - 12 - i * 7,
        size: 5.5,
        font: this.font,
        color: GREY,
      }),
    );
  }

  ensure(height: number) {
    if (this.y - height < this.margin) this.newPage();
  }

  wrap(text: string, size: number, width: number, font = this.font): string[] {
    const words = printable(text).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  text(
    text: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      indent?: number;
    } = {},
  ) {
    const size = options.size ?? 8;
    const font = options.bold ? this.bold : this.font;
    for (const line of this.wrap(
      text,
      size,
      this.width - (options.indent ?? 0),
      font,
    )) {
      this.ensure(size + 3);
      this.page.drawText(line, {
        x: this.margin + (options.indent ?? 0),
        y: this.y - size,
        size,
        font,
        color: options.color ?? BLACK,
      });
      this.y -= size + 3;
    }
  }

  heading(text: string) {
    this.ensure(30);
    this.y -= 6;
    this.text(text, { size: 10, bold: true });
    this.page.drawLine({
      start: { x: this.margin, y: this.y + 1 },
      end: { x: this.margin + this.width, y: this.y + 1 },
      thickness: 0.5,
      color: GREY,
    });
    this.y -= 4;
  }

  banner(text: string, color: ReturnType<typeof rgb>) {
    this.ensure(22);
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - 18,
      width: this.width,
      height: 18,
      color,
    });
    this.page.drawText(printable(text), {
      x: this.margin + 6,
      y: this.y - 13,
      size: 10,
      font: this.bold,
      color: rgb(1, 1, 1),
    });
    this.y -= 24;
  }

  table(headers: string[], rows: string[][], widths: number[], size = 6.5) {
    const total = widths.reduce((s, w) => s + w, 0);
    const scale = this.width / total;
    const columns = widths.map((w) => w * scale);
    const drawRow = (cells: string[], font: PDFFont, shade: boolean) => {
      const height = size + 4;
      this.ensure(height + 2);
      if (shade) {
        this.page.drawRectangle({
          x: this.margin,
          y: this.y - height,
          width: this.width,
          height,
          color: rgb(0.93, 0.93, 0.93),
        });
      }
      let x = this.margin;
      cells.forEach((cell, i) => {
        let value = printable(cell ?? '');
        while (
          value.length > 1 &&
          font.widthOfTextAtSize(value, size) > columns[i] - 2
        )
          value = value.slice(0, -1);
        this.page.drawText(value, {
          x: x + 1,
          y: this.y - size - 1,
          size,
          font,
        });
        x += columns[i];
      });
      this.page.drawLine({
        start: { x: this.margin, y: this.y - height },
        end: { x: this.margin + this.width, y: this.y - height },
        thickness: 0.2,
        color: GREY,
      });
      this.y -= height;
    };
    drawRow(headers, this.bold, true);
    rows.forEach((row) => {
      if (this.y - (size + 6) < this.margin) {
        this.newPage();
        drawRow(headers, this.bold, true);
      }
      drawRow(row, this.font, false);
    });
    this.y -= 4;
  }
}

const blankRow = (label: string, altitude: number) => [
  label,
  String(Math.round(altitude)),
  ...new Array<string>(17).fill(''),
];

// The minimum safe altitude of a leg: "?" when unknown, nothing on a plan
// saved before them.
export const msaCell = (leg: LegResult): string =>
  !leg.terrain
    ? ''
    : leg.terrain.msaFt === null
      ? '?'
      : String(leg.terrain.msaFt);

// One row per point flown, TOC and TOD rows where they fall along a leg.
function legRows(legs: LegResult[], result: FlightPlanResult): string[][] {
  const rows: string[][] = [];
  const first = legs[0];
  const takeoff = new Date(
    new Date(result.departureTime).getTime() + TAXI_OUT_MINUTES * 60000,
  );
  const departure = blankRow(
    pointLabel(first.from),
    first.from.elevationFt ?? 0,
  );
  departure[14] = hhmm(takeoff);
  departure[16] = one(result.fuel.loadedL - result.fuel.taxiL);
  departure[18] = first.from.frequency ?? '';
  rows.push(departure);
  let cumulative = 0;
  for (const leg of legs) {
    for (const segment of leg.segments) {
      if (segment.phase === 'CLIMB' && segment.toNm < leg.distanceNm - 0.05) {
        rows.push(blankRow(`  TOC +${one(segment.toNm)}`, segment.endAltFt));
      }
      if (segment.phase === 'DESCENT' && segment.fromNm > 0.05) {
        rows.push(
          blankRow(`  TOD +${one(segment.fromNm)}`, segment.startAltFt),
        );
      }
    }
    cumulative += leg.distanceNm;
    const radios = leg.crossings
      .filter((c) => c.relation !== 'ABOVE' && c.relation !== 'BELOW')
      .map((c) => {
        const radio = c.airspace.frequencies[0];
        return `${c.airspace.name}${radio ? ` ${radio.mhz}` : ''}`;
      });
    rows.push([
      pointLabel(leg.to),
      String(leg.altitudeFt),
      msaCell(leg),
      deg(leg.trueCourseDeg),
      deg(leg.magneticCourseDeg),
      leg.wind.source === 'NONE'
        ? '000/0*'
        : `${deg(leg.wind.directionDeg)}/${leg.wind.speedKt}`,
      `${leg.windCorrectionDeg >= 0 ? '+' : ''}${Math.round(leg.windCorrectionDeg)}`,
      deg(leg.magneticHeadingDeg),
      String(Math.round(leg.tasKt)),
      String(Math.round(leg.groundSpeedKt)),
      one(leg.distanceNm),
      one(cumulative),
      String(Math.round(leg.timeMin)),
      minutes(leg.cumulativeTimeMin),
      hhmm(leg.eta),
      '',
      one(leg.fuelRemainingL),
      '',
      [leg.to.frequency, ...radios].filter(Boolean).join(' ; '),
    ]);
  }
  return rows;
}

function drawEnvelope(writer: Writer, result: FlightPlanResult) {
  const envelope = result.massBalance.envelope.points;
  if (envelope.length < 3) return;
  const height = 150;
  writer.ensure(height + 20);
  const width = Math.min(260, writer.width);
  const x0 = writer.margin + 30;
  const y0 = writer.y - height;
  const points = [
    ...envelope.map((p) => [p.armM, p.massKg]),
    [result.massBalance.takeoff.cgM, result.massBalance.takeoff.massKg],
    [result.massBalance.landing.cgM, result.massBalance.landing.massKg],
  ];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const sx = (v: number) =>
    x0 + ((v - minX) / (maxX - minX || 1)) * (width - 40);
  const sy = (v: number) =>
    y0 + ((v - minY) / (maxY - minY || 1)) * (height - 20);
  writer.page.drawRectangle({
    x: x0 - 4,
    y: y0 - 4,
    width: width - 32,
    height: height - 12,
    borderColor: GREY,
    borderWidth: 0.3,
  });
  for (let i = 0; i < envelope.length; i++) {
    const a = envelope[i];
    const b = envelope[(i + 1) % envelope.length];
    writer.page.drawLine({
      start: { x: sx(a.armM), y: sy(a.massKg) },
      end: { x: sx(b.armM), y: sy(b.massKg) },
      thickness: 1,
      color: BLACK,
    });
  }
  const to = result.massBalance.takeoff;
  const ldg = result.massBalance.landing;
  writer.page.drawLine({
    start: { x: sx(to.cgM), y: sy(to.massKg) },
    end: { x: sx(ldg.cgM), y: sy(ldg.massKg) },
    thickness: 1,
    color: ORANGE,
  });
  const placed: [number, number][] = [];
  for (const [state, label] of [
    [to, 'DEC/TO'],
    [ldg, 'ATT/LDG'],
  ] as const) {
    const below = labelBelow(placed, [sx(state.cgM), sy(state.massKg)]);
    placed.push([sx(state.cgM), sy(state.massKg)]);
    writer.page.drawCircle({
      x: sx(state.cgM),
      y: sy(state.massKg),
      size: 2.5,
      color: state.withinEnvelope ? GREEN : RED,
    });
    writer.page.drawText(label, {
      x: sx(state.cgM) + 4,
      y: sy(state.massKg) + (below ? -8 : 2),
      size: 6,
      font: writer.font,
    });
  }
  writer.page.drawText(`${minX.toFixed(3)} m`, {
    x: x0,
    y: y0 - 12,
    size: 6,
    font: writer.font,
    color: GREY,
  });
  writer.page.drawText(`${maxX.toFixed(3)} m`, {
    x: x0 + width - 70,
    y: y0 - 12,
    size: 6,
    font: writer.font,
    color: GREY,
  });
  writer.page.drawText(`${Math.round(minY)} kg`, {
    x: writer.margin,
    y: y0,
    size: 6,
    font: writer.font,
    color: GREY,
  });
  writer.page.drawText(`${Math.round(maxY)} kg`, {
    x: writer.margin,
    y: y0 + height - 24,
    size: 6,
    font: writer.font,
    color: GREY,
  });
  writer.y = y0 - 18;
}

const QNH_OLD_CODES = new Set(['QNH_METAR_OLD', 'QNH_DEFAULTED']);
const qnhIsOld = (notices: { code: string }[]) =>
  notices.some((n) => QNH_OLD_CODES.has(n.code));

/** Where the QNH of the plan comes from: a METAR and its time, the pilot, or none. */
export function qnhOrigin(
  result: Pick<
    FlightPlanResult,
    'qnhSource' | 'qnhStation' | 'qnhObservedAt' | 'departureTime'
  >,
  language: Language,
): string {
  const source = result.qnhSource ?? 'INPUT';
  if (source !== 'METAR') return t(language, `navplan.pdf.qnhSource.${source}`);
  const observed = result.qnhObservedAt ? new Date(result.qnhObservedAt) : null;
  return t(language, 'navplan.pdf.qnhSource.METAR', {
    icao: result.qnhStation ?? '',
    time: observed ? utcTime(observed, new Date(result.departureTime)) : '?',
  });
}

/** The navigation data line: an AIRAC cycle, or aerodrome data without a cycle. */
export function navdataLabel(
  result: Pick<FlightPlanResult, 'navdata'>,
  language: Language,
): string {
  const { airac, effectiveFrom, stale } = result.navdata;
  const date = new Date(effectiveFrom).toISOString().slice(0, 10);
  const label =
    airac === 'OURAIRPORTS'
      ? t(language, 'navplan.pdf.navdata.ourairports', { date })
      : airac === 'NONE'
        ? t(language, 'navplan.pdf.navdata.none')
        : t(language, 'navplan.pdf.navdata.airac', { airac, date });
  return stale
    ? `${label} — ${t(language, 'navplan.pdf.navdata.stale')}`
    : label;
}

/** Day or night, then twilight, sunrise and sunset of each aerodrome of the plan. */
export function sunLines(
  result: Pick<FlightPlanResult, 'daylight'>,
  language: Language,
): string[] {
  const daylight = result.daylight;
  if (!daylight) return [];
  const time = (value: Date | string | null) => (value ? hhmm(value) : '—');
  return [
    `${t(language, 'navplan.pdf.sun')} — ${
      daylight.night && daylight.nightFrom
        ? t(language, 'navplan.pdf.sun.night', {
            time: utcTime(new Date(daylight.nightFrom)),
          })
        : t(language, 'navplan.pdf.sun.day')
    }`,
    ...daylight.aerodromes.map((a) =>
      t(language, 'navplan.pdf.sun.line', {
        icao: a.icao,
        role: renderTranslation(
          language,
          `navplan.role.${a.role}` as TranslationKey,
        ),
        date: a.date,
        dawn: time(a.civilDawn),
        sunrise: time(a.sunrise),
        sunset: time(a.sunset),
        dusk: time(a.civilDusk),
      }),
    ),
  ];
}

// Obstacles less than 500 ft below the planned altitude, one line per leg.
export function obstacleLines(legs: LegResult[], language: Language): string[] {
  return legs
    .filter((leg) => (leg.obstacles ?? []).length > 0)
    .map(
      (leg) =>
        `${t(language, 'navplan.pdf.obstacles', {
          leg: `${pointLabel(leg.from)}-${pointLabel(leg.to)}`,
        })} ${(leg.obstacles ?? [])
          .map(
            (o) =>
              `${o.type}${o.count > 1 ? ` x${o.count}` : ''} ${o.amslFt} ft (+${one(o.alongNm)} NM)`,
          )
          .join(', ')}`,
    );
}

const signed = (value: number, positive: string, negative: string) =>
  `${Math.abs(value)} ${value >= 0 ? positive : negative}`;

const SIA_STATUSES = new Set(['CAP', 'RST', 'PRV', 'MIL', 'OFF']);

// The heading line of an aerodrome, then status, frequencies, hours, fuel,
// METAR wind and density altitude; warn: worth the pilot's attention.
export function aerodromeLines(
  aerodrome: NonNullable<FlightPlanResult['aerodromes']>[number],
  language: Language,
): { text: string; warn: boolean }[] {
  const role = renderTranslation(
    language,
    `navplan.role.${aerodrome.role}` as TranslationKey,
  );
  const sheet = aerodrome.sheet ? renderSheet(aerodrome.sheet, language) : null;
  const lines: { text: string; warn: boolean }[] = [
    {
      text: `${role} ${aerodrome.icao}${sheet?.name ? ` ${sheet.name}` : ''}${sheet?.elevationFt != null ? ` — ${sheet.elevationFt} ft` : ''}`,
      warn: false,
    },
  ];
  if (!sheet) return lines;
  // OurAirports gives its own types ("medium_airport"): not a SIA status.
  if (sheet.status && SIA_STATUSES.has(sheet.status))
    lines.push({
      text: t(language, `navplan.aerodrome.status.${sheet.status}`),
      warn: sheet.status !== 'CAP',
    });
  const radio = aerodrome.sheet
    ? navLogFrequency(aerodrome.sheet, aerodrome.role)
    : null;
  if (radio) lines.push({ text: radio, warn: false });
  if (sheet.atsHours)
    lines.push({
      text: `${t(language, 'navplan.pdf.atsHours')} : ${sheet.atsHours.split('\n').join(' · ')}`,
      warn: false,
    });
  lines.push({
    text: `${t(language, 'navplan.pdf.fuelAvailable')} : ${sheet.fuelTypes.length ? sheet.fuelTypes.join(', ') : t(language, 'navplan.pdf.fuelNone')}${sheet.fuelHours ? ` (${sheet.fuelHours.split('\n')[0]})` : ''}`,
    warn: sheet.fuelTypes.length === 0,
  });
  if (sheet.vacUrl) lines.push({ text: `VAC : ${sheet.vacUrl}`, warn: false });
  const c = aerodrome.conditions;
  if (c) {
    const wind =
      c.metar.windSpeedKt === null
        ? '?'
        : c.metar.windDirectionDeg === null
          ? `${c.metar.variable ? 'VRB' : '000'}/${c.metar.windSpeedKt} kt`
          : `${deg(c.metar.windDirectionDeg)}/${c.metar.windSpeedKt}${c.metar.gustKt ? `G${c.metar.gustKt}` : ''} kt`;
    lines.push({
      text: t(language, 'navplan.pdf.metarConditions', {
        wind,
        temperature: c.metar.temperatureC ?? '?',
        qnh: c.metar.qnhHpa ?? '?',
        da: c.densityAltitudeFt ?? '?',
      }),
      warn: false,
    });
  }
  return lines;
}

// One row per runway direction: QFU, declared distances, size, METAR wind.
export function aerodromeRunwayRows(
  aerodrome: NonNullable<FlightPlanResult['aerodromes']>[number],
  language: Language,
): string[][] {
  const rows: string[][] = [];
  const winds = aerodrome.conditions?.runways ?? [];
  for (const runway of aerodrome.sheet?.runways ?? []) {
    for (const end of runway.ends ?? []) {
      const wind = winds.find((r) => r.designator === end.designator);
      rows.push([
        `${end.designator}${end.magneticBearingDeg !== null ? ` QFU ${deg(end.magneticBearingDeg)}` : ''}`,
        end.toraM !== null ? `${end.toraM} m` : '—',
        end.ldaM !== null ? `${end.ldaM} m` : '—',
        `${runway.lengthM ?? '?'} x ${runway.widthM ?? '?'} m ${runway.surface ?? ''}`.trim(),
        wind
          ? `${wind.best ? '* ' : ''}${t(
              language,
              'navplan.pdf.rwy.components',
              {
                head: signed(
                  wind.headwindKt,
                  t(language, 'navplan.pdf.rwy.head'),
                  t(language, 'navplan.pdf.rwy.tail'),
                ),
                cross: signed(
                  wind.crosswindKt,
                  t(language, 'navplan.pdf.rwy.right'),
                  t(language, 'navplan.pdf.rwy.left'),
                ),
              },
            )}`
          : '',
      ]);
    }
  }
  return rows;
}

// The line above the distance table of an aerodrome (mass, pressure
// altitude, temperature, safety factor), then what limits it.
export function distanceHeading(
  distances: AerodromeDistances,
  language: Language,
): string[] {
  if (distances.dataMissing)
    return [t(language, 'navplan.pdf.distances.missing')];
  return [
    t(
      language,
      distances.kind === 'TAKEOFF'
        ? 'navplan.pdf.distances.takeoff'
        : 'navplan.pdf.distances.landing',
      {
        mass: distances.massKg ?? '?',
        pa: distances.pressureAltitudeFt,
        temperature: distances.temperatureC,
        conditions: distances.conditionsSource,
        factor: distances.safetyFactor,
      },
    ),
    ...distances.messages.map((m) => printable(renderMessage(language, m))),
  ];
}

// One row per runway direction: conditions, the manual's figures, the
// factors, what is needed and what is available.
export function distanceRows(
  distances: AerodromeDistances,
  language: Language,
): string[][] {
  const takeoff = distances.kind === 'TAKEOFF';
  return distances.runways.map((runway) => [
    `${runway.suggested ? '* ' : ''}${runway.designator}`,
    [
      `${runway.surfaceText ?? runway.surface}${runway.wet ? ` ${t(language, 'navplan.pdf.dist.wet')}` : ''}`,
      runway.slopePercent === null ? null : `${runway.slopePercent} %`,
      runway.headwindKt === null
        ? null
        : signed(
            runway.headwindKt,
            t(language, 'navplan.pdf.rwy.head'),
            t(language, 'navplan.pdf.rwy.tail'),
          ),
    ]
      .filter(Boolean)
      .join(', '),
    runway.tableGroundRollM === null
      ? '—'
      : `${runway.tableGroundRollM} / ${runway.tableDistance15mM} m`,
    runway.factors
      .map(
        (f) =>
          `${t(language, `navplan.pdf.dist.factor.${f.code}`)} x${f.factor}${f.source === 'CAA_SSL7' ? ' (CAA)' : ''}`,
      )
      .join(', '),
    runway.requiredDistance15mM === null
      ? '—'
      : `${runway.requiredGroundRollM} / ${runway.requiredDistance15mM} m`,
    takeoff
      ? `${runway.availableRunM ?? '?'} / ${runway.availableDistanceM ?? '?'} m`
      : `${runway.availableDistanceM ?? '?'} m`,
    runway.marginM === null ? '—' : `${runway.marginM} m`,
    t(language, `navplan.pdf.dist.status.${runway.status}`),
  ]);
}

// The 0 °C isotherm at the departure, along the route and at the
// destination.
export function freezingLine(
  result: Pick<FlightPlanResult, 'freezingLevels'>,
  language: Language,
): string | null {
  const levels = result.freezingLevels ?? [];
  if (levels.length === 0) return null;
  return `${t(language, 'navplan.pdf.freezing')} : ${levels
    .map((level) => {
      const place = level.ident ?? t(language, 'navplan.pdf.freezing.route');
      switch (level.state) {
        case 'LEVEL':
          return `${place} ${level.altitudeFt} ft`;
        case 'SURFACE':
          return `${place} ${t(language, 'navplan.pdf.freezing.surface')}`;
        case 'ABOVE':
          return `${place} > ${level.topFt} ft`;
        default:
          return `${place} ?`;
      }
    })
    .join(' · ')}`;
}

export async function buildDossierPdf(
  options: DossierOptions,
): Promise<string> {
  const { result, language } = options;
  const doc = await PDFDocument.create();
  doc.setTitle(
    `${renderTranslation(language, 'navplan.pdf.title')} ${result.legs[0]?.from.ident ?? ''}-${result.legs[result.legs.length - 1]?.to.ident ?? ''}`,
  );
  doc.setProducer('Skycrew');
  const { regular: font, bold } = embedDossierFonts(doc);
  const size: [number, number] =
    options.format === 'A5' ? [595.28, 419.53] : [595.28, 841.89];
  const footer = `${printable(renderTranslation(language, 'navplan.notice.disclaimer'))} ${printable(result.navdata.source)}`;
  const w = new Writer(doc, size, font, bold, 24, footer, language);

  const route = [
    result.legs[0] ? pointLabel(result.legs[0].from) : '',
    ...result.legs.map((l) => pointLabel(l.to)),
  ].join(' - ');
  w.text(`${t(language, 'navplan.pdf.title')} — ${route}`, {
    size: 13,
    bold: true,
  });
  w.text(
    `${t(language, 'navplan.pdf.aircraft')} : ${options.aircraft}   ${t(language, 'navplan.pdf.pilot')} : ${options.pilot}   ${t(language, 'navplan.pdf.date')} : ${new Date(result.departureTime).toISOString().slice(0, 16).replace('T', ' ')}`,
  );
  w.text(
    `${t(language, 'navplan.pdf.qnh')} : ${one(result.qnhHpa)} hPa (${qnhOrigin(result, language)})   ${t(language, 'navplan.pdf.navdata')} : ${navdataLabel(result, language)}`,
    {
      color: result.navdata.stale || qnhIsOld(result.notices) ? ORANGE : BLACK,
    },
  );
  w.text(
    `${t(language, 'navplan.pdf.winds')} : ${result.windSource}. ${t(language, 'navplan.pdf.forecastNotice')}`,
    { size: 7, color: GREY },
  );
  sunLines(result, language).forEach((line, i) =>
    w.text(line, {
      size: 7,
      color: i === 0 && result.daylight?.night ? ORANGE : GREY,
    }),
  );
  if (result.status === 'BLOCKING')
    w.banner(t(language, 'navplan.pdf.blocking'), RED);
  else if (result.status === 'WARNING')
    w.banner(t(language, 'navplan.pdf.warning'), ORANGE);
  else w.banner(t(language, 'navplan.pdf.ok'), GREEN);

  // Warnings first, right under the verdict.
  w.heading(t(language, 'navplan.pdf.notices'));
  for (const notice of result.notices) {
    w.text(
      `${t(language, `navplan.pdf.status.${notice.status}`)} — ${renderMessage(language, notice.message)}`,
      {
        size: 7,
        color:
          notice.status === 'BLOCKING'
            ? RED
            : notice.status === 'WARNING'
              ? ORANGE
              : BLACK,
      },
    );
  }
  w.text(t(language, 'navplan.pdf.links'), { size: 7 });

  // Navigation log.
  w.heading(t(language, 'navplan.pdf.navLog'));
  const columns = [
    'point',
    'alt',
    'msa',
    'tc',
    'mc',
    'wind',
    'wca',
    'mh',
    'tas',
    'gs',
    'dist',
    'cumDist',
    'time',
    'cumTime',
    'eta',
    'ata',
    'fuel',
    'fuelActual',
    'radio',
  ];
  const legs = [
    ...result.legs,
    ...(result.alternateLeg ? [result.alternateLeg] : []),
  ];
  w.table(
    columns.map((c) => t(language, `navplan.pdf.col.${c}`)),
    legRows(legs, result),
    [
      40, 24, 22, 16, 16, 28, 16, 16, 16, 16, 20, 22, 16, 22, 20, 20, 22, 20,
      84,
    ],
    options.format === 'A5' ? 6 : 6.5,
  );
  if (legs.some((leg) => leg.wind.source === 'NONE'))
    w.text(t(language, 'navplan.pdf.windNone'), { size: 7, color: ORANGE });
  obstacleLines(legs, language).forEach((line) =>
    w.text(line, { size: 7, color: ORANGE }),
  );
  const terrain = legs.find((leg) => leg.terrain)?.terrain;
  if (terrain)
    w.text(
      t(language, 'navplan.pdf.msaNotice', {
        corridor: terrain.corridorNm,
        margin: terrain.marginFt,
      }),
      { size: 6.5, color: GREY },
    );
  if (result.terrainSource)
    w.text(result.terrainSource.attribution, { size: 6, color: GREY });

  // Aerodromes: what the VAC reader checks before leaving.
  if ((result.aerodromes ?? []).length > 0) {
    w.heading(t(language, 'navplan.pdf.aerodromes'));
    for (const aerodrome of result.aerodromes ?? []) {
      aerodromeLines(aerodrome, language).forEach((line, i) =>
        w.text(line.text, {
          size: i === 0 ? 8 : 7,
          bold: i === 0,
          color: line.warn ? ORANGE : BLACK,
        }),
      );
      const runways = aerodromeRunwayRows(aerodrome, language);
      if (runways.length)
        w.table(
          [
            t(language, 'navplan.pdf.rwy.qfu'),
            t(language, 'navplan.pdf.rwy.tora'),
            t(language, 'navplan.pdf.rwy.lda'),
            t(language, 'navplan.pdf.rwy.size'),
            t(language, 'navplan.pdf.rwy.wind'),
          ],
          runways,
          [3, 1.4, 1.4, 3, 3],
          6.5,
        );
      const distances = aerodrome.distances;
      if (distances) {
        distanceHeading(distances, language).forEach((line, i) =>
          w.text(line, {
            size: 7,
            bold: i === 0,
            color: i === 0 ? BLACK : ORANGE,
          }),
        );
        if (!distances.dataMissing && distances.runways.length)
          w.table(
            [
              t(language, 'navplan.pdf.dist.runway'),
              t(language, 'navplan.pdf.dist.conditions'),
              t(language, 'navplan.pdf.dist.table'),
              t(language, 'navplan.pdf.dist.factors'),
              t(language, 'navplan.pdf.dist.required'),
              t(
                language,
                distances.kind === 'TAKEOFF'
                  ? 'navplan.pdf.dist.availableTakeoff'
                  : 'navplan.pdf.dist.availableLanding',
              ),
              t(language, 'navplan.pdf.dist.margin'),
              t(language, 'navplan.pdf.dist.status'),
            ],
            distanceRows(distances, language),
            [0.9, 2.6, 1.8, 5.6, 2, 1.7, 1.1, 1.4],
            6,
          );
      }
    }
  }

  // Fuel.
  w.heading(t(language, 'navplan.pdf.fuel'));
  const fuel = result.fuel;
  w.table(
    ['', 'L'],
    [
      [t(language, 'navplan.pdf.fuel.taxi'), one(fuel.taxiL)],
      [t(language, 'navplan.pdf.fuel.trip'), one(fuel.tripL)],
      [t(language, 'navplan.pdf.fuel.contingency'), one(fuel.contingencyL)],
      [t(language, 'navplan.pdf.fuel.alternate'), one(fuel.alternateL)],
      [
        t(language, 'navplan.pdf.fuel.reserve', {
          minutes: fuel.finalReserveMin,
        }),
        one(fuel.finalReserveL),
      ],
      [t(language, 'navplan.pdf.fuel.margin'), one(fuel.clubMarginL)],
      [t(language, 'navplan.pdf.fuel.minimum'), one(fuel.minimumBlockL)],
      [t(language, 'navplan.pdf.fuel.loaded'), one(fuel.loadedL)],
      [t(language, 'navplan.pdf.fuel.extra'), one(fuel.extraL)],
      [t(language, 'navplan.pdf.fuel.landing'), one(fuel.landingL)],
      [t(language, 'navplan.pdf.fuel.endurance'), minutes(fuel.enduranceMin)],
    ],
    [3, 1],
  );
  for (const message of fuel.messages)
    w.text(renderMessage(language, message), { color: RED });

  if (options.format === 'A4') {
    // Mass and balance.
    w.heading(t(language, 'navplan.pdf.mb'));
    const mb = result.massBalance;
    if (mb.lines.length) {
      w.table(
        [
          t(language, 'navplan.pdf.mb.station'),
          t(language, 'navplan.pdf.mb.mass'),
          t(language, 'navplan.pdf.mb.arm'),
          t(language, 'navplan.pdf.mb.moment'),
        ],
        [
          ...mb.lines.map((l) => [
            l.stationId === 'EMPTY'
              ? t(language, 'navplan.pdf.mb.empty')
              : l.label,
            one(l.massKg),
            l.armM.toFixed(3),
            l.momentKgm.toFixed(2),
          ]),
          [
            t(language, 'navplan.pdf.mb.takeoff'),
            one(mb.takeoff.massKg),
            mb.takeoff.cgM.toFixed(4),
            mb.takeoff.momentKgm.toFixed(2),
          ],
          [
            t(language, 'navplan.pdf.mb.landing'),
            one(mb.landing.massKg),
            mb.landing.cgM.toFixed(4),
            mb.landing.momentKgm.toFixed(2),
          ],
        ],
        [3, 1, 1, 1],
      );
      drawEnvelope(w, result);
      w.text(
        t(language, 'navplan.pdf.mb.notice', {
          date: options.weighingDate
            ? new Date(options.weighingDate).toISOString().slice(0, 10)
            : '?',
        }),
        { size: 7, color: GREY },
      );
    }
    for (const message of mb.messages)
      w.text(renderMessage(language, message), { color: RED });

    // Airspaces.
    w.heading(t(language, 'navplan.pdf.airspaces'));
    const crossings = legs.flatMap((leg) =>
      leg.crossings.map((c) => ({ leg, c })),
    );
    const unverified = result.unverifiedAirspaces ?? [];
    for (const u of unverified) {
      w.text(renderMessage(language, u.message), { size: 7, color: ORANGE });
    }
    if (crossings.length === 0 && unverified.length === 0) {
      const key = emptyAirspacesKey(result.notices);
      w.text(t(language, key), {
        color: key === 'navplan.pdf.airspaces.none' ? BLACK : ORANGE,
      });
    }
    for (const { leg, c } of crossings) {
      w.text(
        `${pointLabel(leg.from)}-${pointLabel(leg.to)} ${one(c.entryNm)}-${one(c.exitNm)} NM : ${c.airspace.name}${c.airspace.icaoClass ? ` (${c.airspace.icaoClass})` : ''} [${altitudeLimitLabel(c.airspace.floor)} / ${altitudeLimitLabel(c.airspace.ceiling)}] ${t(language, `navplan.pdf.relation.${c.relation}`)} — ${renderMessage(language, c.requirement)}`,
        {
          size: 7,
          color:
            c.status === 'BLOCKING'
              ? RED
              : c.status === 'WARNING'
                ? ORANGE
                : BLACK,
        },
      );
      // Hours and the first remark (bypass, PPR, phone): the rest is on the
      // screen.
      const hours = c.airspace.hours;
      const remark = (c.airspace.remarks ?? '').split('\n')[0];
      const details = [
        hours
          ? `${t(language, 'navplan.pdf.hours')} : ${hours.split('\n').join(' · ')}`
          : null,
        remark || null,
      ].filter(Boolean);
      if (details.length)
        w.text(details.join(' — '), { size: 6.5, color: GREY, indent: 10 });
    }

    // Weather.
    w.heading(t(language, 'navplan.pdf.weather'));
    for (const report of result.weather) {
      if (report.metar) w.text(report.metar, { size: 7 });
      if (report.taf) w.text(report.taf, { size: 7, color: GREY });
    }
    const freezing = freezingLine(result, language);
    if (freezing) w.text(freezing, { size: 7 });
  }

  await font.embed();
  await bold.embed();
  return Buffer.from(await doc.save()).toString('base64');
}
