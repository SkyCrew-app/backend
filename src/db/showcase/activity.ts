import { Random } from './random';
import { ClubDay, clubInstant, DAY, HOUR } from './calendar';
import { FleetAircraft } from './fleet';
import {
  DraftAdminAction,
  DraftBooking,
  DraftMember,
  DraftNotification,
} from './model';
import { Window } from './schedule';
import { maintenanceWindow } from '../../modules/maintenance/maintenance-rules';
import { MaintenanceType } from '../../modules/maintenance/entity/maintenance-type.enum';
import {
  clubDayStart,
  clubMonthStart,
  mailDate,
} from '../../modules/reservations/booking-rules';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';
import { translate } from '../../common/i18n/translate';
import { formatDate } from '../../common/i18n/languages';
import { NOTIFICATION_PRIORITY_HIGH } from '../../modules/notifications/notification-priority';
import { NOTIFIED_DAYS } from './ledger';

const MINUTE = 60_000;
const fullName = (m: DraftMember) => `${m.first_name} ${m.last_name}`;

// ---------- Maintenance ----------

export interface DraftMaintenance {
  aircraft: FleetAircraft;
  technician: DraftMember;
  start: Date;
  // The last day of the work (the aircraft is held through it).
  endDate: Date;
  status: 'COMPLETED' | 'IN_PROGRESS';
  type: MaintenanceType;
  description: string;
  parts: string | null;
  cost: number;
  id?: number;
}

const VISITS: [MaintenanceType, string, string | null, number][] = [
  [
    MaintenanceType.INSPECTION,
    'Visite 50 heures : contrôle moteur, filtre et niveaux, essais au sol.',
    'Huile moteur (6 L), filtre à huile',
    420,
  ],
  [
    MaintenanceType.INSPECTION,
    'Visite 100 heures : inspection complète cellule et moteur, compressions OK.',
    'Bougies (8), filtre à air, huile moteur (6 L)',
    1380,
  ],
  [
    MaintenanceType.REPAIR,
    'Remplacement de l’alternateur suite à une alarme de charge.',
    'Alternateur échange standard',
    960,
  ],
  [
    MaintenanceType.REPAIR,
    'Réparation d’une fuite au circuit de frein gauche, essais de roulage.',
    'Flexible de frein, liquide hydraulique',
    310,
  ],
  [
    MaintenanceType.CLEANING,
    'Nettoyage complet et traitement anticorrosion des bords d’attaque.',
    null,
    180,
  ],
  [
    MaintenanceType.SOFTWARE_UPDATE,
    'Mise à jour de la base de données de navigation et du transpondeur.',
    null,
    240,
  ],
];

// The maintenances of the history (completed) and the one in progress. They
// are planned before the bookings: no booking may overlap them.
export const planMaintenances = (
  rng: Random,
  now: Date,
  days: ClubDay[],
  fleet: FleetAircraft[],
  technician: DraftMember,
  inMaintenance: FleetAircraft,
): DraftMaintenance[] => {
  const result: DraftMaintenance[] = [];
  const weekdays = days.filter(
    (d) =>
      d.offset < -7 && ['tuesday', 'wednesday', 'thursday'].includes(d.weekday),
  );
  for (const aircraft of fleet) {
    const count = rng.int(1, 2);
    const chosen = rng.shuffle(weekdays).slice(0, count);
    for (const day of chosen) {
      const [type, description, parts, cost] = rng.pick(VISITS);
      const length = type === MaintenanceType.INSPECTION && cost > 1000 ? 2 : 1;
      const clash = result.some(
        (m) =>
          m.aircraft === aircraft &&
          Math.abs(m.start.getTime() - day.start.getTime()) < 10 * DAY,
      );
      if (clash) continue;
      result.push({
        aircraft,
        technician,
        start: clubInstant(day.start, 8 * 60),
        endDate: clubDayStart(day.start, length - 1),
        status: 'COMPLETED',
        type,
        description,
        parts,
        cost: cost + rng.int(-40, 60),
      });
    }
  }
  result.push({
    aircraft: inMaintenance,
    technician,
    start: clubInstant(clubDayStart(now, -3), 8 * 60),
    endDate: clubDayStart(now, 4),
    status: 'IN_PROGRESS',
    type: MaintenanceType.INSPECTION,
    description:
      'Visite annuelle et 100 heures : inspection complète, remplacement des durites carburant, pesée de contrôle.',
    parts: 'Durites carburant, bougies (8), huile moteur (6 L)',
    cost: 2150,
  });
  return result;
};

export const maintenanceWindows = (
  maintenances: DraftMaintenance[],
): Map<string, Window[]> => {
  const windows = new Map<string, Window[]>();
  for (const m of maintenances) {
    const window = maintenanceWindow({
      start_date: m.start,
      end_date: m.endDate,
      status: m.status,
    });
    if (!window) continue;
    const list = windows.get(m.aircraft.key) ?? [];
    list.push(window);
    windows.set(m.aircraft.key, list);
  }
  return windows;
};

// ---------- Incidents ----------

export interface DraftIncident {
  aircraft: FleetAircraft;
  booking: DraftBooking;
  author: DraftMember;
  date: Date;
  description: string;
  damage: string | null;
  actions: string | null;
  severity: 'low' | 'medium' | 'high';
  status: 'Ouvert' | 'En cours' | 'Résolu';
  priority: 'low' | 'medium' | 'high';
  category: string;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  resolvedBy: DraftMember | null;
  id?: number;
}

export interface IncidentOutcome {
  incidents: DraftIncident[];
  groundedAt: Date | null;
  adminActions: DraftAdminAction[];
  notifications: DraftNotification[];
}

// The incidents of the history, and the one that grounds `grounded`: the
// last flight made on it. Bookings of that aircraft after the grounding are
// cancelled by an administrator (made before it) or never made.
export const planIncidents = (
  rng: Random,
  now: Date,
  bookings: DraftBooking[],
  grounded: FleetAircraft,
  technician: DraftMember,
  office: DraftMember[],
): IncidentOutcome => {
  const incidents: DraftIncident[] = [];
  const adminActions: DraftAdminAction[] = [];
  const notifications: DraftNotification[] = [];
  const flown = bookings.filter((b) => b.flight && !b.cancelledAt);

  const last = [...flown]
    .filter(
      (b) =>
        b.aircraft.key === grounded.key &&
        b.flight!.arrival.getTime() < now.getTime() - 20 * HOUR &&
        b.flight!.arrival.getTime() > now.getTime() - 6 * DAY,
    )
    .pop();
  let groundedAt: Date | null = null;
  if (last) {
    groundedAt = new Date(last.flight!.arrival.getTime() + 15 * MINUTE);
    const incident: DraftIncident = {
      aircraft: grounded,
      booking: last,
      author: last.pilot,
      date: last.flight!.arrival,
      description:
        'Atterrissage dur en piste 24 par vent de travers rafaleux. Rebond puis impact du train avant ; vibrations anormales au roulage.',
      damage:
        'Carénage de roue avant fendu, trace de contact possible en bout de pale. Pas de dommage visible sur la cellule.',
      actions:
        'Avion arrêté en bout de piste et ramené au hangar par tracteur. Inspection hélice et train avant demandée.',
      severity: 'high',
      status: 'En cours',
      priority: 'high',
      category: 'mechanical',
      resolutionNote: null,
      resolvedAt: null,
      resolvedBy: null,
    };
    incidents.push(incident);
    adminActions.push({
      actor: technician,
      at: new Date(groundedAt.getTime() + 18 * HOUR),
      action: ADMIN_ACTION.INCIDENT_STATUS_CHANGED,
      targetType: 'incident',
      targetId: () => String(incident.id),
      targetLabel: null,
      summary: () => ({ from: 'Ouvert', to: 'En cours' }),
    });

    // Bookings booked before the grounding are cancelled by the office.
    const affected = bookings.filter(
      (b) =>
        b.aircraft.key === grounded.key &&
        b.start.getTime() > groundedAt!.getTime() &&
        !b.cancelledAt,
    );
    const admin = office[0];
    for (const booking of affected) {
      if (booking.course) {
        throw new Error(
          'Showcase: the grounded aircraft must not be used for courses',
        );
      }
      if (booking.bookedAt.getTime() >= groundedAt.getTime()) {
        // Never booked: the aircraft was already on the ground.
        booking.cancelledAt = null;
        (booking as { dropped?: boolean }).dropped = true;
        continue;
      }
      booking.cancelledAt = new Date(
        groundedAt.getTime() + rng.int(2, 6) * HOUR,
      );
      booking.cancelReason = 'Avion immobilisé à la suite d’un incident';
      booking.cancelledBy = admin;
      booking.flight = null;
      adminActions.push({
        actor: admin,
        at: booking.cancelledAt,
        action: ADMIN_ACTION.RESERVATION_CANCELLED_FOR_MEMBER,
        targetType: 'reservation',
        targetId: () => String(booking.id),
        targetLabel: `${grounded.registration}, ${fullName(booking.pilot)}`,
        summary: () => ({
          memberId: booking.pilot.id ?? null,
          start: booking.start.toISOString(),
          end: booking.end.toISOString(),
        }),
      });
      notifications.push({
        member: booking.pilot,
        type: 'AIRCRAFT_GROUNDED',
        message: () =>
          translate('fr', 'notification.aircraftGrounded', {
            registration: grounded.registration,
            reservationId: booking.id!,
            date: mailDate(booking.start, 'fr'),
          }),
        date: new Date(groundedAt.getTime() + MINUTE),
        read: false,
        priority: null,
        expiration: null,
      });
      notifications.push({
        member: booking.pilot,
        type: 'RESERVATION_CANCELLED',
        message: () =>
          translate('fr', 'notification.reservationCancelled', {
            registration: grounded.registration,
          }),
        date: booking.cancelledAt,
        read: false,
        priority: NOTIFICATION_PRIORITY_HIGH,
        expiration: null,
      });
    }
    // The staff who can put the aircraft back are told (never the club's
    // own accounts: only the showcase staff).
    for (const member of [...office, technician]) {
      notifications.push({
        member,
        type: 'AIRCRAFT_GROUNDED',
        message: () =>
          translate('fr', 'notification.aircraftGroundedStaff', {
            registration: grounded.registration,
            incidentId: incident.id!,
            count: affected.filter((b) => b.cancelledAt).length,
          }),
        date: new Date(groundedAt.getTime() + MINUTE),
        read: member === technician,
        priority: null,
        expiration: null,
      });
    }
  }

  const resolvedStories: Omit<
    DraftIncident,
    | 'aircraft'
    | 'booking'
    | 'author'
    | 'date'
    | 'resolvedAt'
    | 'resolvedBy'
    | 'status'
  >[] = [
    {
      description:
        'Impact d’oiseau en courte finale, bord d’attaque de l’aile droite.',
      damage:
        'Légère déformation du bord d’attaque, pas de dommage structural.',
      actions: 'Inspection par le technicien avant le vol suivant.',
      severity: 'medium',
      priority: 'medium',
      category: 'other',
      resolutionNote:
        'Bord d’attaque contrôlé et redressé, avion remis en service.',
    },
    {
      description:
        'Perte de la radio COM1 pendant 5 minutes en vol, retour après réenclenchement du disjoncteur.',
      damage: null,
      actions: 'Passage sur COM2, vol poursuivi.',
      severity: 'low',
      priority: 'medium',
      category: 'electrical',
      resolutionNote:
        'Connecteur du boîtier audio resserré, essais radio au sol satisfaisants.',
    },
    {
      description:
        'Crevaison du pneu gauche constatée au parking après l’atterrissage.',
      damage: 'Pneu et chambre à air à remplacer.',
      actions: 'Avion laissé au parking, technicien prévenu.',
      severity: 'low',
      priority: 'low',
      category: 'mechanical',
      resolutionNote: 'Pneu et chambre remplacés.',
    },
    {
      description:
        'Remise de gaz en finale : véhicule de l’aéroclub voisin engagé sur la piste sans autorisation.',
      damage: null,
      actions: 'Compte rendu transmis au gestionnaire de la plateforme.',
      severity: 'medium',
      priority: 'high',
      category: 'human_error',
      resolutionNote:
        'Rappel des consignes de circulation côté piste fait aux usagers.',
    },
  ];
  const candidates = rng.shuffle(
    flown.filter(
      (b) =>
        !!b.flight &&
        b.flight.arrival.getTime() < now.getTime() - 12 * DAY &&
        b.aircraft.key !== grounded.key,
    ),
  );
  resolvedStories.forEach((story, index) => {
    const booking = candidates[index];
    if (!booking) return;
    const resolvedAt = new Date(
      booking.flight!.arrival.getTime() + rng.int(1, 6) * DAY,
    );
    const incident: DraftIncident = {
      ...story,
      aircraft: booking.aircraft,
      booking,
      author: booking.pilot,
      date: booking.flight!.arrival,
      status: 'Résolu',
      resolvedAt,
      resolvedBy: technician,
    };
    incidents.push(incident);
    adminActions.push({
      actor: technician,
      at: resolvedAt,
      action: ADMIN_ACTION.INCIDENT_STATUS_CHANGED,
      targetType: 'incident',
      targetId: () => String(incident.id),
      targetLabel: null,
      summary: () => ({ from: 'Ouvert', to: 'Résolu' }),
    });
  });
  // A small one still open.
  const open = flown
    .filter(
      (b) =>
        !!b.flight &&
        b.flight.arrival.getTime() > now.getTime() - 5 * DAY &&
        b.flight!.arrival.getTime() < now.getTime() &&
        b.aircraft.key !== grounded.key,
    )
    .pop();
  if (open) {
    incidents.push({
      aircraft: open.aircraft,
      booking: open,
      author: open.pilot,
      date: open.flight!.arrival,
      description:
        'Rail de réglage du siège avant droit dur à manœuvrer, le siège se bloque mal.',
      damage: null,
      actions: 'Siège vérifié verrouillé avant le vol.',
      severity: 'low',
      status: 'Ouvert',
      priority: 'low',
      category: 'mechanical',
      resolutionNote: null,
      resolvedAt: null,
      resolvedBy: null,
    });
  }
  return { incidents, groundedAt, adminActions, notifications };
};

// ---------- Notifications about bookings, courses and licences ----------

export const activityNotifications = (
  rng: Random,
  now: Date,
  bookings: DraftBooking[],
  members: DraftMember[],
): DraftNotification[] => {
  const out: DraftNotification[] = [];
  const recent = (at: Date) =>
    at.getTime() <= now.getTime() &&
    now.getTime() - at.getTime() < NOTIFIED_DAYS * DAY;
  const read = (at: Date) =>
    now.getTime() - at.getTime() > 3 * DAY ? rng.chance(0.85) : rng.chance(0.3);
  for (const booking of bookings) {
    const registration = booking.aircraft.registration;
    if (recent(booking.bookedAt)) {
      out.push({
        member: booking.pilot,
        type: 'RESERVATION_CONFIRMED',
        message: () =>
          translate('fr', 'notification.reservationConfirmed', {
            registration,
          }),
        date: booking.bookedAt,
        read: read(booking.bookedAt),
        priority: null,
        expiration: null,
      });
      if (booking.instructor) {
        out.push({
          member: booking.instructor,
          type: 'INSTRUCTION_BOOKED',
          message: () =>
            translate('fr', 'notification.instructionBookedForInstructor', {
              student: fullName(booking.pilot),
              registration,
              date: mailDate(booking.start, 'fr'),
            }),
          date: booking.bookedAt,
          read: read(booking.bookedAt),
          priority: null,
          expiration: null,
        });
      }
    }
    if (
      booking.cancelledAt &&
      !booking.cancelledBy &&
      recent(booking.cancelledAt)
    ) {
      out.push({
        member: booking.pilot,
        type: 'RESERVATION_CANCELLED',
        message: () =>
          translate('fr', 'notification.reservationCancelled', {
            registration,
          }),
        date: booking.cancelledAt,
        read: true,
        priority: null,
        expiration: null,
      });
    }
    const course = booking.course;
    if (course?.status === 'COMPLETED') {
      const at = clubDayStart(course.end, 1);
      if (recent(at)) {
        for (const member of [course.student, course.instructor]) {
          out.push({
            member,
            type: 'COURSE_COMPLETED',
            message: () =>
              translate('fr', 'notification.courseCompleted', {
                courseId: course.id!,
              }),
            date: at,
            read: read(at),
            priority: null,
            expiration: null,
          });
        }
      }
    }
  }
  // Licence reminders the API would have sent (60, 30 and 7 days before).
  for (const member of members) {
    for (const licence of member.licences) {
      const expiry = licence.expiration_date;
      if (licence.status === 'expired') {
        const at = clubDayStart(expiry, 1);
        out.push({
          member,
          type: 'LICENSE_EXPIRED',
          message: () =>
            translate('fr', 'notification.licenceExpired', {
              licenceType: licence.license_type,
            }),
          date: at,
          read: false,
          priority: null,
          expiration: expiry,
        });
        continue;
      }
      const step = licence.reminderDays;
      if (step == null) continue;
      const at = new Date(
        Math.min(expiry.getTime() - step * DAY, now.getTime() - HOUR),
      );
      const days = Math.ceil((expiry.getTime() - at.getTime()) / DAY);
      out.push({
        member,
        type: 'LICENSE_EXPIRING_SOON',
        message: () =>
          translate('fr', 'notification.licenceExpiresIn', {
            licenceType: licence.license_type,
            days,
            date: formatDate('fr', expiry),
          }),
        date: at,
        read: false,
        priority: days <= 7 ? NOTIFICATION_PRIORITY_HIGH : null,
        expiration: expiry,
      });
    }
  }
  return out;
};

// Licences of members who joined during the history were checked by the
// office: a "licence validated" line each.
export const licenceValidations = (
  historyStart: Date,
  members: DraftMember[],
  office: DraftMember,
): DraftAdminAction[] =>
  members.flatMap((member) =>
    member.joined.getTime() < historyStart.getTime()
      ? []
      : member.licences.map((licence) => ({
          actor: office,
          at: new Date(member.joined.getTime() + 26 * HOUR),
          action: ADMIN_ACTION.LICENCE_VALIDATED,
          targetType: 'licence',
          targetId: () => String(licence.id),
          targetLabel: `${licence.license_type} ${licence.license_number}`,
          summary: () => ({
            memberId: String(member.id),
            from: 'pending',
            to: 'active',
          }),
        })),
  );

// ---------- Money the club spends ----------

export interface DraftExpense {
  date: Date;
  amount: number;
  category: string;
  sub: string | null;
  description: string;
  aircraft: FleetAircraft | null;
}

export const planExpenses = (
  rng: Random,
  now: Date,
  historyStart: Date,
  bookings: DraftBooking[],
  maintenances: DraftMaintenance[],
  fuelPrice: number,
): DraftExpense[] => {
  const expenses: DraftExpense[] = [];
  for (let month = 0; ; month++) {
    const start = clubMonthStart(historyStart, month);
    if (start.getTime() > now.getTime()) break;
    const next = clubMonthStart(historyStart, month + 1);
    const at = (day: number) =>
      new Date(start.getTime() + (day - 1) * DAY + 10 * HOUR);
    const label = formatDate('fr', start).slice(3);
    const hours = bookings
      .filter(
        (b) =>
          b.flight &&
          b.flight.departure.getTime() >= start.getTime() &&
          b.flight.departure.getTime() < next.getTime(),
      )
      .reduce((sum, b) => sum + b.flight!.hours, 0);
    const litres = Math.round(hours * 31);
    const add = (
      day: number,
      amount: number,
      category: string,
      sub: string | null,
      description: string,
      aircraft: FleetAircraft | null = null,
    ) => {
      if (at(day).getTime() <= now.getTime()) {
        expenses.push({
          date: at(day),
          amount: Math.round(amount * 100) / 100,
          category,
          sub,
          description,
          aircraft,
        });
      }
    };
    if (litres > 0) {
      add(
        rng.int(3, 8),
        litres * (fuelPrice || 2.45),
        'Carburant',
        '100LL',
        `Livraison citerne club : ${litres} L de 100LL`,
      );
    }
    add(
      1,
      1250,
      'Infrastructure',
      'Location hangar',
      `Loyer du hangar — ${label}`,
    );
    add(
      1,
      690,
      'Assurance',
      'Flotte',
      `Assurance flotte et responsabilité civile — échéance ${label}`,
    );
    add(
      rng.int(10, 15),
      140 + rng.int(0, 60),
      'Infrastructure',
      'Électricité',
      `Électricité hangar et club-house — ${label}`,
    );
    add(
      rng.int(15, 20),
      85,
      'Administratif',
      'Abonnements',
      'Abonnements météo et cartes aéronautiques',
    );
    if (month % 3 === 1) {
      add(
        rng.int(18, 25),
        380 + rng.int(0, 120),
        'Administratif',
        'Redevances',
        'Redevances d’usage de la plateforme (trimestre)',
      );
    }
  }
  for (const m of maintenances.filter((x) => x.status === 'COMPLETED')) {
    expenses.push({
      date: new Date(m.endDate.getTime() + 14 * HOUR),
      amount: m.cost,
      category: 'Maintenance',
      sub:
        m.type === MaintenanceType.INSPECTION
          ? 'Visite'
          : m.type === MaintenanceType.REPAIR
            ? 'Réparation'
            : 'Entretien',
      description: `${m.description.split(':')[0].split('.')[0]} — ${m.aircraft.registration}`,
      aircraft: m.aircraft,
    });
  }
  return expenses.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export interface DraftReport {
  date: Date;
  revenue: number;
  expense: number;
  recommendation: string;
  perMember: number;
}

// The monthly reports the API writes on the 1st, for the months of the
// history that are over: revenue from the bookings charged, expenses as
// recorded.
export const planReports = (
  now: Date,
  historyStart: Date,
  bookings: DraftBooking[],
  expenses: DraftExpense[],
  memberCount: number,
): DraftReport[] => {
  const reports: DraftReport[] = [];
  for (let month = 1; ; month++) {
    const start = clubMonthStart(historyStart, month);
    const next = clubMonthStart(historyStart, month + 1);
    if (next.getTime() > now.getTime()) break;
    const within = (date: Date) =>
      date.getTime() >= start.getTime() && date.getTime() < next.getTime();
    const revenue =
      bookings
        .filter((b) => !b.cancelledAt && within(b.start))
        .reduce((sum, b) => sum + b.priceCents, 0) / 100;
    const expense =
      Math.round(
        expenses
          .filter((e) => within(e.date))
          .reduce((sum, e) => sum + e.amount, 0) * 100,
      ) / 100;
    const net = revenue - expense;
    reports.push({
      date: start,
      revenue,
      expense,
      recommendation:
        net >= 0
          ? 'Activité soutenue : résultat positif sur le mois. Maintenir le suivi des heures avant les visites programmées.'
          : 'Mois déficitaire (activité réduite ou maintenance lourde). Surveiller la trésorerie avant les échéances d’assurance.',
      perMember: Math.round((revenue / Math.max(1, memberCount)) * 100) / 100,
    });
  }
  return reports;
};
