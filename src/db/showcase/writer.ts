import { EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { ShowcaseTracker } from './tracker';
import { ShowcasePlan } from './build';
import { DraftBooking, DraftMember, ROLE_OF } from './model';
import { performanceSource, DEMO_DATA_WARNING, FleetAircraft } from './fleet';
import { BASE } from './content';
import {
  ARTICLES,
  AUDIT_REMARKS,
  AUDIT_TEMPLATE,
  CHECKLIST_ITEMS,
  E_LEARNING,
} from './library';
import { computeShowcasePlans, PLAN_ENGINE } from './flight-plans';
import { DAY, HOUR } from './calendar';
import { Random } from './random';
import { User } from '../../modules/users/entity/users.entity';
import { Role } from '../../modules/roles/entity/roles.entity';
import { License } from '../../modules/licenses/entity/licenses.entity';
import {
  Aircraft,
  AvailabilityStatus,
} from '../../modules/aircraft/entity/aircraft.entity';
import {
  AircraftMassBalanceEntity,
  AircraftPerformanceEntity,
} from '../../modules/aircraft/entity/aircraft-flight-data.entity';
import { Maintenance } from '../../modules/maintenance/entity/maintenance.entity';
import {
  Reservation,
  ReservationStatus,
} from '../../modules/reservations/entity/reservations.entity';
import { ReservationTemplate } from '../../modules/reservations/entity/reservation-template.entity';
import { Flight } from '../../modules/flights/entity/flights.entity';
import { InstructionCourse } from '../../modules/instruction-courses/entity/instruction-courses.entity';
import { CourseCompetency } from '../../modules/instruction-courses/entity/course-competency.entity';
import { CourseComment } from '../../modules/instruction-courses/entity/course-comment.entity';
import { CourseStatus } from '../../modules/instruction-courses/enum/course-status.enum';
import { Incident } from '../../modules/incidents/entity/incidents.entity';
import { Invoice } from '../../modules/invoices/entity/invoices.entity';
import { Payment } from '../../modules/payments/entity/payments.entity';
import { sanitizeSummary } from '../../common/admin-actions/admin-actions';
import { Notification } from '../../modules/notifications/entity/notifications.entity';
import { Article } from '../../modules/article/entity/article.entity';
import { Course } from '../../modules/e-learning/entity/course.entity';
import { Module } from '../../modules/e-learning/entity/module.entity';
import { Lesson } from '../../modules/e-learning/entity/lesson.entity';
import { Evaluation } from '../../modules/eval/entity/evaluation.entity';
import { Question } from '../../modules/eval/entity/question.entity';
import { Answer } from '../../modules/eval/entity/answer.entity';
import { UserProgress } from '../../modules/users/entity/user-progress.entity';
import { AuditTemplate } from '../../modules/audit/entity/audit-template.entity';
import { AuditTemplateItem } from '../../modules/audit/entity/audit-template-item.entity';
import { AuditItem } from '../../modules/audit/entity/audit-item.entity';
import { Audit } from '../../modules/audit/entity/audit.entity';
import { AuditResultType } from '../../modules/audit/enums/audit-result.enum';
import { AuditFrequencyType } from '../../modules/audit/enums/audit-frequency.enum';
import { ChecklistTemplate } from '../../modules/checklists/entity/checklist-template.entity';
import { ChecklistItem } from '../../modules/checklists/entity/checklist-item.entity';
import {
  ChecklistSubmission,
  ChecklistSubmissionStatus,
} from '../../modules/checklists/entity/checklist-submission.entity';
import { Expense } from '../../modules/financial/entity/expense.entity';
import { FinancialReport } from '../../modules/financial/entity/financial-report.entity';
import { FlightPlanEntity } from '../../modules/navplan/entity/flight-plan.entity';
import { LicenseType } from '../../shared/enums/licence-type.enum';
import { FlightCategory } from '../../modules/reservations/entity/reservations.entity';

const MINUTE = 60_000;
const BCRYPT_ROUNDS = 10;

export interface Credential {
  role: string;
  name: string;
  email: string;
  password: string;
}

export interface WriteOutcome {
  credentials: Credential[];
  counts: Record<string, number>;
  warnings: string[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// A password that is shown once and stored only as its hash.
export const strongPassword = (): string =>
  randomBytes(18)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': 'x', '/': 'K', '=': '7' })[c]!) + '!9a';

const dashboardWidgets = [
  { widgetId: 'weather', visible: true, order: 0, size: 'lg' },
  { widgetId: 'quick-actions', visible: true, order: 1, size: 'sm' },
  { widgetId: 'upcoming-reservations', visible: true, order: 2, size: 'md' },
  { widgetId: 'recent-flights', visible: true, order: 3, size: 'md' },
  { widgetId: 'flight-hours-stats', visible: true, order: 4, size: 'md' },
  { widgetId: 'fleet-availability', visible: true, order: 5, size: 'md' },
  { widgetId: 'articles', visible: true, order: 6, size: 'lg' },
];

// Writes the planned club. Only inserts: no row that existed before is read
// for writing, changed or deleted. Nothing here sends an e-mail or calls a
// service that could.
export const writeShowcase = async (
  manager: EntityManager,
  plan: ShowcasePlan,
): Promise<WriteOutcome> => {
  const tracker = new ShowcaseTracker(manager);
  const rng = new Random(plan.seed ^ 0x5eed);
  const { now } = plan;
  const warnings: string[] = [];
  const office = plan.members.filter((m) => m.kind === 'office');
  const technician = plan.members.find((m) => m.kind === 'technician')!;

  // ---- Members ----
  const roles = await manager.getRepository(Role).find();
  const roleId = (name: string) => {
    const role = roles.find((r) => r.role_name === name);
    if (!role) throw new Error(`Showcase: role "${name}" is missing`);
    return role.id;
  };
  // Members without a presentation account cannot sign in: their hash is of
  // a secret nobody keeps.
  const lockedHash = await bcrypt.hash(
    randomBytes(32).toString('hex'),
    BCRYPT_ROUNDS,
  );
  const credentials: Credential[] = [];
  const memberRows: Partial<User>[] = [];
  for (const member of plan.members) {
    let password = lockedHash;
    if (member.login) {
      const clear = strongPassword();
      password = await bcrypt.hash(clear, BCRYPT_ROUNDS);
      credentials.push({
        role: member.login,
        name: `${member.first_name} ${member.last_name}`,
        email: member.email,
        password: clear,
      });
    }
    memberRows.push({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      password,
      is2FAEnabled: false,
      isEmailConfirmed: true,
      is_active: true,
      phone_number: member.phone,
      address: member.address,
      date_of_birth: member.birth,
      total_flight_hours: round2(member.priorHours + member.closedHours),
      user_account_balance: member.balanceCents / 100,
      email_notifications_enabled: true,
      sms_notifications_enabled: false,
      newsletter_subscribed: rng.chance(0.7),
      language: 'fr',
      speed_unit: 'kt',
      distance_unit: 'nm',
      timezone: 'Europe/Paris',
      preferred_aerodrome: BASE.icao,
      role: { id: roleId(ROLE_OF[member.kind]) } as Role,
      dashboard_widgets: dashboardWidgets,
    });
  }
  const memberIds = await tracker.insert(User, memberRows);
  plan.members.forEach((m, i) => (m.id = memberIds[i]));
  const ref = (member: DraftMember | null | undefined) =>
    member ? ({ id: member.id } as User) : null;

  const licences = plan.members.flatMap((m) => m.licences);
  const licenceIds = await tracker.insert(
    License,
    licences.map((l) => ({
      user: ref(l.member),
      license_type: l.license_type,
      issue_date: l.issue_date,
      expiration_date: l.expiration_date,
      certification_authority: 'DGAC',
      is_valid: l.is_valid,
      status: l.status,
      license_number: l.license_number,
      expiry_reminder_days: l.reminderDays,
      expiry_reminder_for: l.reminderDays != null ? l.expiration_date : null,
    })),
  );
  licences.forEach((l, i) => (l.id = licenceIds[i]));

  // ---- Fleet and flight data ----
  const fleetIds = await tracker.insert(
    Aircraft,
    plan.fleet.map((a) => ({
      registration_number: a.registration,
      model: a.model,
      year_of_manufacture: a.year,
      maxAltitude: a.maxAltitude,
      cruiseSpeed: a.cruiseSpeed,
      consumption: a.consumption,
      fuel_capacity: a.fuelCapacity,
      fuel_type: '100LL',
      empty_weight: a.massBalance.emptyMassKg,
      max_takeoff_weight: a.massBalance.mtowKg,
      image_url: null,
      documents_url: null,
      availability_status: a.grounded
        ? AvailabilityStatus.UNAVAILABLE
        : AvailabilityStatus.AVAILABLE,
      maintenance_status: 'OK',
      hourly_cost: a.hourlyCost,
      total_flight_hours: a.totalHours,
    })),
  );
  plan.fleet.forEach((a, i) => (a.id = fleetIds[i]));
  const aircraftId = (a: FleetAircraft) =>
    plan.fleet.find((x) => x.key === a.key)!.id!;
  const validatedAt = new Date(now.getTime() - 20 * DAY);
  await tracker.insert(
    AircraftPerformanceEntity,
    plan.fleet.map((a) => ({
      aircraft_id: a.id,
      template_code: a.templateCode,
      fuel: a.performance.fuel,
      climb: a.performance.climb,
      cruise: a.performance.cruise,
      descent: a.performance.descent,
      reserve: a.performance.reserve,
      arrival_fuel_l: a.performance.arrivalFuelL,
      calibration: a.performance.calibration,
      service_ceiling_ft: a.performance.serviceCeilingFt,
      source: performanceSource(a),
      validated_by_id: office[0].id,
      validated_at: validatedAt,
    })),
  );
  await tracker.insert(
    AircraftMassBalanceEntity,
    plan.fleet.map((a) => ({
      aircraft_id: a.id,
      empty_mass_kg: a.massBalance.emptyMassKg,
      empty_arm_m: a.massBalance.emptyArmM,
      weighing_date: a.massBalance.weighingDate as Date,
      weighing_ref: a.massBalance.weighingRef ?? DEMO_DATA_WARNING,
      mtow_kg: a.massBalance.mtowKg,
      mlw_kg: a.massBalance.mlwKg,
      mzfw_kg: a.massBalance.mzfwKg ?? null,
      stations: a.massBalance.stations,
      combined_limits: a.massBalance.combinedLimits,
      envelopes: a.massBalance.envelopes,
      validated_by_id: office[0].id,
      validated_at: validatedAt,
    })),
  );

  await tracker.insert(
    Maintenance,
    plan.maintenances.map((m) => ({
      aircraft: { id: aircraftId(m.aircraft) } as Aircraft,
      technician: ref(m.technician),
      start_date: m.start,
      end_date: m.endDate,
      status: m.status,
      maintenance_type: m.type,
      description: m.description,
      parts_changed: m.parts,
      maintenance_cost: m.cost,
    })),
  );

  // ---- Bookings, in the order they were made. A cancelled booking is
  // deleted by the API: it only takes an id, which its money lines keep.
  const bookings = [...plan.bookings].sort(
    (a, b) => a.bookedAt.getTime() - b.bookedAt.getTime(),
  );
  const sequence: { seq: string }[] = await manager.query(
    `SELECT pg_get_serial_sequence('"reservations"', 'id') AS seq`,
  );
  const bookingRow = (b: DraftBooking) => ({
    aircraft: { id: aircraftId(b.aircraft) } as Aircraft,
    user: ref(b.pilot),
    instructor: ref(b.instructor),
    reservation_date: b.bookedAt,
    start_time: b.start,
    end_time: b.end,
    estimated_flight_hours: round2(
      (b.end.getTime() - b.start.getTime()) / HOUR,
    ),
    purpose: b.purpose,
    status: ReservationStatus.CONFIRMED,
    flight_category: b.category,
    notes: b.notes,
    number_of_passengers: b.passengers,
    charged_amount: b.priceCents / 100,
  });
  // Rows in a row are written together; a cancelled one takes its id from
  // the sequence between them.
  let pending: DraftBooking[] = [];
  const flush = async () => {
    const ids = await tracker.insert(
      Reservation,
      pending.map(bookingRow) as never,
    );
    pending.forEach((b, i) => (b.id = ids[i]));
    pending = [];
  };
  for (const booking of bookings) {
    if (!booking.cancelledAt) {
      pending.push(booking);
      continue;
    }
    await flush();
    const [row] = await manager.query(`SELECT nextval($1::regclass) AS id`, [
      sequence[0].seq,
    ]);
    booking.id = Number(row.id);
  }
  await flush();
  const active = bookings.filter((b) => !b.cancelledAt);

  // ---- Flights of the bookings flown ----
  const flown = active.filter((b) => b.flight);
  const flightIds = await tracker.insert(
    Flight,
    flown.map((b) => {
      const f = b.flight!;
      return {
        reservation: { id: b.id } as Reservation,
        user: ref(b.pilot),
        instructor: ref(b.instructor),
        flight_hours: f.hours,
        flight_type: b.category,
        origin_icao: f.origin,
        destination_icao: f.destination,
        weather_conditions: null,
        number_of_passengers: f.passengers,
        departure_time: f.departure,
        arrival_time: f.arrival,
        remarks: f.remarks,
        closed_at: f.closedAt,
        plan_engine: null,
      } as Partial<Flight>;
    }),
  );
  flown.forEach((b, i) => (b.flight!.id = flightIds[i]));

  // ---- Instruction courses ----
  const courseIds = await tracker.insert(
    InstructionCourse,
    plan.courses.map((c) => ({
      instructor: ref(c.instructor),
      student: ref(c.student),
      startTime: c.start,
      endTime: c.end,
      reservation:
        c.booking && !c.booking.cancelledAt
          ? ({ id: c.booking.id } as Reservation)
          : null,
      status: CourseStatus[c.status === 'CANCELED' ? 'CANCELED' : c.status],
      feedback: c.feedback,
      rating: c.rating,
    })),
  );
  plan.courses.forEach((c, i) => (c.id = courseIds[i]));
  await tracker.insert(
    CourseCompetency,
    plan.courses.flatMap((c) =>
      c.competencies.map((k) => ({
        name: k.name,
        description: k.description,
        validated: k.validated,
        validatedBy: k.validated ? ref(c.instructor) : null,
        validatedAt: k.validatedAt,
        course: { id: c.id } as InstructionCourse,
      })),
    ),
  );
  await tracker.insert(
    CourseComment,
    plan.courses.flatMap((c) =>
      c.comments.map((k) => ({
        content: k.content,
        creationDate: k.at,
        author: ref(k.author),
        course: { id: c.id } as InstructionCourse,
      })),
    ),
  );

  // ---- Incidents ----
  const incidentIds = await tracker.insert(
    Incident,
    plan.incidents.map((x) => ({
      aircraft: { id: aircraftId(x.aircraft) } as Aircraft,
      flight: x.booking.flight?.id
        ? ({ id: x.booking.flight.id } as Flight)
        : null,
      user: ref(x.author),
      incident_date: x.date,
      description: x.description,
      damage_report: x.damage,
      corrective_actions: x.actions,
      severity_level: x.severity,
      status: x.status,
      priority: x.priority,
      category: x.category,
      resolution_note: x.resolutionNote,
      resolved_at: x.resolvedAt,
      resolved_by: ref(x.resolvedBy),
    })),
  );
  plan.incidents.forEach((x, i) => (x.id = incidentIds[i]));

  // ---- Money: invoices, then the lines of the accounts ----
  const invoiceIds = await tracker.insert(
    Invoice,
    plan.invoices.map((inv) => ({
      invoice_number: inv.number,
      user: ref(inv.member),
      amount: inv.amountCents / 100,
      invoice_date: inv.date,
      payment_status: 'completed',
      payment_method: inv.method,
      invoice_items: JSON.stringify(inv.lines()),
      amount_paid: inv.amountCents / 100,
      balance_due: 0,
    })),
  );
  plan.invoices.forEach((inv, i) => (inv.id = invoiceIds[i]));
  const paymentIds = await tracker.insert(
    Payment,
    plan.payments.map((p) => ({
      user: ref(p.member),
      invoice: p.invoice ? ({ id: p.invoice.id } as Invoice) : null,
      amount: p.amountCents / 100,
      payment_date: p.date,
      payment_method: p.method,
      payment_status: p.status,
      external_payment_id: p.externalId,
      kind: p.kind,
      reason: p.reason,
      reservation_id: p.booking?.id ?? null,
      created_by_id: p.createdBy?.id ?? null,
    })) as never,
  );
  plan.payments.forEach((p, i) => (p.id = paymentIds[i]));

  // ---- Checklists ----
  const models = [...new Set(plan.fleet.map((a) => a.model))];
  const templateIds = await tracker.insert(
    ChecklistTemplate,
    models.map((model) => ({
      aircraft_model: model,
      name: `Visite pré-vol ${model}`,
      description: 'Visite pré-vol du club, à faire avant chaque vol.',
      is_active: true,
      created_by: ref(technician),
      created_at: plan.historyStart,
    })),
  );
  const itemIdsByModel = new Map<string, number[]>();
  for (const [index, model] of models.entries()) {
    const ids = await tracker.insert(
      ChecklistItem,
      CHECKLIST_ITEMS.map(([category, name, description, required], order) => ({
        template: { id: templateIds[index] } as ChecklistTemplate,
        category,
        item_name: name,
        description,
        is_required: required,
        sort_order: order + 1,
        created_at: plan.historyStart,
      })),
    );
    itemIdsByModel.set(model, ids);
  }
  const checked = flown.filter(
    (b) => now.getTime() - b.start.getTime() < 30 * DAY && rng.chance(0.75),
  );
  await tracker.insert(
    ChecklistSubmission,
    checked.map((b) => {
      const model = b.aircraft.model;
      const items = itemIdsByModel.get(model)!;
      return {
        template: {
          id: templateIds[models.indexOf(model)],
        } as ChecklistTemplate,
        pilot: ref(b.pilot),
        reservation: { id: b.id } as Reservation,
        status: ChecklistSubmissionStatus.COMPLETED,
        responses: items.map((itemId, index) => ({
          itemId,
          checked: CHECKLIST_ITEMS[index][3] || rng.chance(0.3),
        })),
        started_at: b.start,
        completed_at: new Date(b.start.getTime() + rng.int(8, 15) * MINUTE),
        created_at: b.start,
      };
    }) as never,
  );

  // ---- Safety audits ----
  const [auditTemplateId] = await tracker.insert(AuditTemplate, [
    {
      name: AUDIT_TEMPLATE.name,
      description: AUDIT_TEMPLATE.description,
      recommended_frequency: AuditFrequencyType.ANNUEL,
      applicable_aircraft_types: models,
      is_active: true,
      created_by: ref(technician),
      created_at: plan.historyStart,
      version: 1,
    },
  ]);
  await tracker.insert(
    AuditTemplateItem,
    AUDIT_TEMPLATE.items.map(
      ([category, title, description, criticality], index) => ({
        template: { id: auditTemplateId } as AuditTemplate,
        order_index: index + 1,
        category,
        title,
        description,
        criticality,
        is_mandatory: true,
        requires_photo_evidence: false,
      }),
    ),
  );
  for (const aircraft of plan.fleet) {
    const date = new Date(now.getTime() - rng.int(15, 160) * DAY);
    const remarks = rng.chance(0.5) ? rng.pick(AUDIT_REMARKS) : null;
    const itemIds = await tracker.insert(
      AuditItem,
      AUDIT_TEMPLATE.items.map(([category, title], index) => ({
        category,
        description: title,
        result:
          remarks && index === 3
            ? AuditResultType.CONFORME_AVEC_REMARQUES
            : AuditResultType.CONFORME,
        notes: remarks && index === 3 ? remarks : null,
        requires_action: !!remarks && index === 3,
      })),
    );
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + 1);
    const [auditId] = await tracker.insert(Audit, [
      {
        aircraft: { id: aircraft.id } as Aircraft,
        audit_date: date,
        audit_result: remarks
          ? AuditResultType.CONFORME_AVEC_REMARQUES
          : AuditResultType.CONFORME,
        audit_notes: remarks
          ? `Audit annuel : ${remarks}`
          : 'Audit annuel : rien à signaler.',
        corrective_actions: remarks ? 'À traiter à la prochaine visite.' : null,
        next_audit_date: next,
        audit_frequency: AuditFrequencyType.ANNUEL,
        auditor: ref(technician),
        is_closed: true,
        closed_date: new Date(date.getTime() + 2 * DAY),
        closed_by: ref(office[0]),
        created_at: date,
      },
    ]);
    // The link rows have no key of their own: removing the audit or its
    // items removes them (see removal.ts).
    await manager
      .createQueryBuilder()
      .relation(Audit, 'audit_items')
      .of(auditId)
      .add(itemIds);
  }

  // ---- E-learning, evaluations and the students' progress ----
  const students = plan.members.filter((m) => m.kind === 'student');
  if (plan.instruction) {
    for (const content of E_LEARNING) {
      const [courseId] = await tracker.insert(Course, [
        {
          title: content.title,
          description: content.description,
          category: content.category,
          required_license: LicenseType.PPL,
        },
      ]);
      for (const moduleContent of content.modules) {
        const [moduleId] = await tracker.insert(Module, [
          {
            title: moduleContent.title,
            description: moduleContent.description,
            courseId,
          },
        ]);
        const lessonIds = await tracker.insert(
          Lesson,
          moduleContent.lessons.map((l) => ({
            title: l.title,
            description: l.description,
            content: l.content,
            attachments: [],
            module: { id: moduleId } as Module,
          })),
        );
        const [evaluationId] = await tracker.insert(Evaluation, [
          { module: { id: moduleId } as Module, pass_score: 70 },
        ]);
        const questionIds = await tracker.insert(
          Question,
          moduleContent.questions.map((q) => ({
            content: { text: q.text },
            options: q.options,
            correct_answer: q.correct,
            evaluationId,
          })),
        );
        for (const student of students) {
          const progress = Math.min(
            1,
            (now.getTime() - student.joined.getTime()) / (120 * DAY),
          );
          const lessonsDone = Math.round(
            lessonIds.length * progress * (0.5 + rng.next() * 0.5),
          );
          const progressRows: Partial<UserProgress>[] = [];
          for (let i = 0; i < lessonsDone; i++) {
            progressRows.push({
              user: ref(student),
              lesson: { id: lessonIds[i] } as Lesson,
              completed: true,
              completed_at: new Date(
                student.joined.getTime() + (i + 1) * rng.int(3, 9) * DAY,
              ),
            });
          }
          if (lessonsDone === lessonIds.length && rng.chance(0.85)) {
            const at = new Date(
              Math.min(
                now.getTime() - HOUR,
                student.joined.getTime() + rng.int(20, 60) * DAY,
              ),
            );
            const correct = moduleContent.questions.map(() => rng.chance(0.8));
            const score = Math.round(
              (correct.filter(Boolean).length / correct.length) * 100,
            );
            await tracker.insert(
              Answer,
              moduleContent.questions.map((q, i) => ({
                answer_text: correct[i]
                  ? q.correct
                  : q.options.find((o) => o !== q.correct),
                is_correct: correct[i],
                user: ref(student),
                question: { id: questionIds[i] } as Question,
                submitted_at: at,
              })),
            );
            progressRows.push({
              user: ref(student),
              evaluation: { id: evaluationId } as Evaluation,
              completed: true,
              score,
              passed: score >= 70,
              completed_at: at,
            });
          }
          await tracker.insert(UserProgress, progressRows);
        }
      }
    }
  }

  // ---- News ----
  await tracker.insert(
    Article,
    ARTICLES.map((a) => ({
      title: a.title,
      description: a.description,
      text: a.text,
      tags: a.tags,
      eventDate:
        a.event != null ? new Date(now.getTime() + a.event * DAY) : null,
      createdAt: new Date(now.getTime() + a.days * DAY),
      updatedAt: new Date(now.getTime() + a.days * DAY),
    })),
  );

  // ---- Expenses and monthly reports ----
  await tracker.insert(
    Expense,
    plan.expenses.map((e) => ({
      expense_date: e.date,
      amount: e.amount,
      category: e.category,
      sub_category: e.sub,
      description: e.description,
      aircraft: e.aircraft
        ? ({ id: aircraftId(e.aircraft) } as Aircraft)
        : null,
    })),
  );
  await tracker.insert(
    FinancialReport,
    plan.reports.map((r) => ({
      report_date: r.date,
      total_revenue: r.revenue,
      total_expense: r.expense,
      net_profit: Math.round((r.revenue - r.expense) * 100) / 100,
      recommendations: r.recommendation,
      average_revenue_per_member: r.perMember,
    })),
  );

  // ---- Booking templates of a few members ----
  const pilot = plan.members.find((m) => m.login === 'pilot');
  const regulars = [
    pilot,
    ...plan.members
      .filter((m) => m.kind === 'pilot' && m.activity >= 8)
      .slice(0, 2),
  ].filter((m): m is DraftMember => !!m);
  await tracker.insert(
    ReservationTemplate,
    regulars.flatMap((m, index) => [
      {
        name: index === 0 ? 'Samedi matin — Régent' : 'Vol du samedi',
        user: ref(m),
        aircraft: { id: aircraftId(plan.fleet[2]) } as Aircraft,
        day_of_week: 6,
        preferred_start_time: '09:00',
        preferred_end_time: '11:00',
        flight_category: FlightCategory.LOCAL,
        purpose: 'Vol local',
        estimated_flight_hours: 1.5,
        created_at: new Date(now.getTime() - 40 * DAY),
      },
    ]) as never,
  );

  // ---- Flight plans of the new engine, on the next trips ----
  const tripBookings = active
    .filter(
      (b: DraftBooking) =>
        b.start.getTime() > now.getTime() + 2 * HOUR &&
        b.destination &&
        (b.pilot.login === 'pilot' ||
          b.category === FlightCategory.CROSS_COUNTRY),
    )
    .sort(
      (a, b) =>
        Number(b.pilot.login === 'pilot') - Number(a.pilot.login === 'pilot') ||
        a.start.getTime() - b.start.getTime(),
    )
    .slice(0, 6);
  const computed = await computeShowcasePlans(
    manager,
    tripBookings,
    (aircraft) => ({
      performance: aircraft.performance,
      massBalance: aircraft.massBalance,
    }),
    now,
  );
  warnings.push(...computed.warnings);
  for (const planned of computed.plans) {
    const { legacy, booking } = planned;
    const [flightId] = await tracker.insert(Flight, [
      {
        ...legacy,
        waypoints: JSON.stringify(legacy.waypoints),
        reservation: { id: booking.id } as Reservation,
        user: ref(booking.pilot),
        instructor: ref(booking.instructor),
        plan_engine: PLAN_ENGINE,
        closed_at: null,
      } as never,
    ]);
    await tracker.insert(FlightPlanEntity, [
      {
        flight_id: flightId,
        reservation_id: booking.id,
        user_id: booking.pilot.id,
        aircraft_id: booking.aircraft.id ?? aircraftId(booking.aircraft),
        input: planned.input,
        result: JSON.parse(JSON.stringify(planned.result)),
        engine_version: planned.result.engineVersion,
        navdata_airac: planned.result.navdata.airac.slice(0, 16),
        weather_fetched_at: null,
        status: planned.result.status,
        created_at: booking.bookedAt,
        updated_at: booking.bookedAt,
      },
    ]);
  }

  // ---- The trace of the office's actions and the notifications ----
  // The trace refuses any UPDATE: its lines are written with their date.
  const actionIds: number[] = [];
  for (const a of plan.adminActions) {
    const [row] = await manager.query(
      `INSERT INTO "admin_actions" ("created_at", "actor_id", "actor_label", "action", "target_type", "target_id", "target_label", "summary") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING "id"`,
      [
        a.at,
        a.actor.id,
        `${a.actor.first_name} ${a.actor.last_name}`,
        a.action,
        a.targetType,
        a.targetId(),
        a.targetLabel,
        JSON.stringify(sanitizeSummary(a.summary())),
      ],
    );
    actionIds.push(Number(row.id));
  }
  await tracker.track('admin_actions', actionIds);
  await tracker.insert(
    Notification,
    plan.notifications.map((n) => ({
      user: ref(n.member),
      notification_type: n.type,
      message: n.message(),
      notification_date: n.date,
      expiration_date: n.expiration,
      is_read: n.read,
      priority: n.priority,
    })),
  );

  return {
    credentials,
    counts: Object.fromEntries(tracker.counts),
    warnings,
  };
};
