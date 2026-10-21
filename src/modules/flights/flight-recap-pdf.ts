import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Flight } from './entity/flights.entity';
import { flightTypeLabel } from './flight-rules';

// The standard PDF fonts only know the Latin-1 characters.
const printable = (text: string): string =>
  text.replace(/→/g, '->').replace(/[^\x20-\x7E -ÿ]/g, '?');

const formatDate = (value?: Date | string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });
};

// 1.5 becomes "1 h 30".
export const formatHours = (hours?: number | null): string | null => {
  if (hours === null || hours === undefined || Number.isNaN(Number(hours))) {
    return null;
  }
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (h === 0) return `${minutes} min`;
  return minutes === 0
    ? `${h} h`
    : `${h} h ${String(minutes).padStart(2, '0')}`;
};

// What the summary of a flight says, as label and value. Empty values are
// left out.
export function flightRecapLines(flight: Flight): Array<[string, string]> {
  const aircraft = flight.reservation?.aircraft;
  const pilot = flight.user
    ? `${flight.user.first_name} ${flight.user.last_name}`
    : null;
  const distance =
    flight.distance_km === null || flight.distance_km === undefined
      ? null
      : `${Math.round(Number(flight.distance_km) * 10) / 10} km`;

  const lines: Array<[string, string | null]> = [
    ['Pilote', pilot],
    [
      'Aéronef',
      aircraft ? `${aircraft.registration_number} (${aircraft.model})` : null,
    ],
    ['Trajet', `${flight.origin_icao} -> ${flight.destination_icao}`],
    ['Type de vol', flightTypeLabel(flight.flight_type) || null],
    ['Départ', formatDate(flight.departure_time)],
    ['Arrivée', formatDate(flight.arrival_time)],
    ['Heures de vol', formatHours(flight.flight_hours)],
    ['Distance', distance],
    [
      'Passagers',
      flight.number_of_passengers === null ||
      flight.number_of_passengers === undefined
        ? null
        : String(flight.number_of_passengers),
    ],
    ['Météo', flight.weather_conditions],
    ['Remarques', flight.remarks],
    ['Clôturé le', formatDate(flight.closed_at)],
  ];

  return lines.filter((line): line is [string, string] => Boolean(line[1]));
}

// Splits a text in lines that fit the given number of characters.
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && current.length + word.length + 1 > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// The summary of a flight as a one-page PDF, encoded in base64.
export async function buildFlightRecapPdf(flight: Flight): Promise<string> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const WIDTH = 595; // A4 portrait
  const HEIGHT = 842;
  const MARGIN = 50;
  const page = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - MARGIN;

  page.drawText('Récapitulatif de vol', { x: MARGIN, y, size: 20, font: bold });
  y -= 22;
  page.drawText(printable(`Vol n° ${flight.id}`), {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 30;

  for (const [label, value] of flightRecapLines(flight)) {
    const valueLines = wrapText(printable(value), 62);
    page.drawText(printable(label), { x: MARGIN, y, size: 11, font: bold });
    for (const line of valueLines) {
      if (y < MARGIN) break;
      page.drawText(line, { x: MARGIN + 130, y, size: 11, font });
      y -= 16;
    }
    y -= 6;
    if (y < MARGIN) break;
  }

  return Buffer.from(await pdf.save()).toString('base64');
}
