import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from './entity/flights.entity';
import { User } from '../users/entity/users.entity';
import { LogbookFilterInput } from './dto/logbook-filter.input';
import { LogbookStats, HoursEntry, MonthlyHoursEntry } from './dto/logbook-stats.type';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

@Injectable()
export class LogbookService {
  private readonly logger = new Logger(LogbookService.name);

  constructor(
    @InjectRepository(Flight)
    private readonly flightsRepository: Repository<Flight>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getLogbookEntries(
    userId: number,
    filter?: LogbookFilterInput,
  ): Promise<Flight[]> {
    const qb = this.flightsRepository
      .createQueryBuilder('flight')
      .leftJoinAndSelect('flight.reservation', 'reservation')
      .leftJoinAndSelect('reservation.aircraft', 'aircraft')
      .leftJoinAndSelect('flight.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy('flight.departure_time', 'DESC');

    if (filter?.startDate) {
      qb.andWhere('flight.departure_time >= :startDate', {
        startDate: filter.startDate,
      });
    }

    if (filter?.endDate) {
      qb.andWhere('flight.departure_time <= :endDate', {
        endDate: filter.endDate,
      });
    }

    if (filter?.aircraftId) {
      qb.andWhere('aircraft.id = :aircraftId', {
        aircraftId: filter.aircraftId,
      });
    }

    if (filter?.flightType) {
      qb.andWhere('flight.flight_type = :flightType', {
        flightType: filter.flightType,
      });
    }

    return qb.getMany();
  }

  async getLogbookStats(
    userId: number,
    filter?: LogbookFilterInput,
  ): Promise<LogbookStats> {
    const flights = await this.getLogbookEntries(userId, filter);

    const totalHours = flights.reduce((sum, f) => sum + (f.flight_hours || 0), 0);
    const totalFlights = flights.length;

    // Hours grouped by aircraft model
    const modelMap = new Map<string, number>();
    for (const flight of flights) {
      const model = flight.reservation?.aircraft?.model ?? 'Inconnu';
      modelMap.set(model, (modelMap.get(model) || 0) + (flight.flight_hours || 0));
    }
    const hoursByModel: HoursEntry[] = Array.from(modelMap.entries()).map(
      ([label, hours]) => ({ label, hours: Math.round(hours * 100) / 100 }),
    );

    // Hours grouped by flight type
    const categoryMap = new Map<string, number>();
    for (const flight of flights) {
      const category = flight.flight_type || 'Inconnu';
      categoryMap.set(
        category,
        (categoryMap.get(category) || 0) + (flight.flight_hours || 0),
      );
    }
    const hoursByCategory: HoursEntry[] = Array.from(
      categoryMap.entries(),
    ).map(([label, hours]) => ({
      label,
      hours: Math.round(hours * 100) / 100,
    }));

    // Monthly hours grouping
    const monthlyMap = new Map<string, number>();
    for (const flight of flights) {
      if (flight.departure_time) {
        const d = new Date(flight.departure_time);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + (flight.flight_hours || 0));
      }
    }
    const monthlyHours: MonthlyHoursEntry[] = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, hours]) => ({ month, hours: Math.round(hours * 100) / 100 }));

    // Average flight duration
    const averageFlightDuration = totalFlights > 0
      ? Math.round((totalHours / totalFlights) * 100) / 100
      : 0;

    // Longest flight
    const longestFlight = flights.reduce(
      (max, f) => Math.max(max, f.flight_hours || 0),
      0,
    );

    // Last 30 and 90 days hours (computed from all user flights, ignoring date filter)
    const allFlights = filter?.startDate || filter?.endDate
      ? await this.getLogbookEntries(userId)
      : flights;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const last30DaysHours = Math.round(
      allFlights
        .filter((f) => f.departure_time && new Date(f.departure_time) >= thirtyDaysAgo)
        .reduce((sum, f) => sum + (f.flight_hours || 0), 0) * 100,
    ) / 100;

    const last90DaysHours = Math.round(
      allFlights
        .filter((f) => f.departure_time && new Date(f.departure_time) >= ninetyDaysAgo)
        .reduce((sum, f) => sum + (f.flight_hours || 0), 0) * 100,
    ) / 100;

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalFlights,
      hoursByModel,
      hoursByCategory,
      monthlyHours,
      averageFlightDuration,
      longestFlight: Math.round(longestFlight * 100) / 100,
      last30DaysHours,
      last90DaysHours,
    };
  }

  async generateDGACPdf(
    userId: number,
    filter?: LogbookFilterInput,
  ): Promise<string> {
    const flights = await this.getLogbookEntries(userId, filter);
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const pilotName = user
      ? `${user.first_name} ${user.last_name}`
      : 'Pilote inconnu';

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const ENTRIES_PER_PAGE = 25;
    const PAGE_WIDTH = 842; // A4 landscape
    const PAGE_HEIGHT = 595;
    const MARGIN = 40;

    const columns = [
      { header: 'Date', width: 75 },
      { header: 'Immatriculation', width: 95 },
      { header: 'Type avion', width: 80 },
      { header: 'Départ (OACI)', width: 85 },
      { header: 'Arrivée (OACI)', width: 85 },
      { header: 'Temps de vol', width: 75 },
      { header: 'Nature du vol', width: 90 },
      { header: 'Observations', width: 140 },
    ];

    const totalPages = Math.max(1, Math.ceil(flights.length / ENTRIES_PER_PAGE));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let y = PAGE_HEIGHT - MARGIN;

      // Title
      page.drawText('Carnet de Vol', {
        x: MARGIN,
        y,
        size: 18,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      y -= 22;

      // Pilot name
      page.drawText(`Pilote : ${pilotName}`, {
        x: MARGIN,
        y,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });

      // Page number
      page.drawText(`Page ${pageIdx + 1} / ${totalPages}`, {
        x: PAGE_WIDTH - MARGIN - 80,
        y,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 25;

      // Table header
      let x = MARGIN;
      for (const col of columns) {
        page.drawText(col.header, {
          x,
          y,
          size: 8,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        x += col.width;
      }
      y -= 2;

      // Header underline
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });
      y -= 14;

      // Rows
      const pageFlights = flights.slice(
        pageIdx * ENTRIES_PER_PAGE,
        (pageIdx + 1) * ENTRIES_PER_PAGE,
      );

      let pageTotalHours = 0;

      for (const flight of pageFlights) {
        const registration =
          flight.reservation?.aircraft?.registration_number ?? '-';
        const aircraftModel =
          flight.reservation?.aircraft?.model ?? '-';
        const date = flight.departure_time
          ? new Date(flight.departure_time).toLocaleDateString('fr-FR')
          : '-';
        const flightHoursStr = flight.flight_hours
          ? `${flight.flight_hours.toFixed(1)}h`
          : '-';
        const remarks = flight.remarks ?? '';

        pageTotalHours += flight.flight_hours || 0;

        const rowData = [
          date,
          registration,
          aircraftModel,
          flight.origin_icao || '-',
          flight.destination_icao || '-',
          flightHoursStr,
          flight.flight_type || '-',
          remarks.length > 25 ? remarks.substring(0, 22) + '...' : remarks,
        ];

        x = MARGIN;
        for (let i = 0; i < columns.length; i++) {
          page.drawText(rowData[i], {
            x,
            y,
            size: 7.5,
            font,
            color: rgb(0, 0, 0),
          });
          x += columns[i].width;
        }
        y -= 14;
      }

      // Cumul at bottom
      y -= 10;
      page.drawLine({
        start: { x: MARGIN, y: y + 8 },
        end: { x: PAGE_WIDTH - MARGIN, y: y + 8 },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });

      page.drawText(
        `Cumul page : ${pageTotalHours.toFixed(1)}h`,
        {
          x: MARGIN,
          y,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        },
      );

      const grandTotal = flights.reduce(
        (sum, f) => sum + (f.flight_hours || 0),
        0,
      );
      page.drawText(`Total général : ${grandTotal.toFixed(1)}h`, {
        x: MARGIN + 200,
        y,
        size: 9,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes).toString('base64');
  }
}
