import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';
import { translate } from '../../common/i18n/translate';
import { clubDayStart } from '../../modules/reservations/booking-rules';
import { DAY, HOUR } from './calendar';
import { LESSONS } from './content';
import {
  DraftAdminAction,
  DraftCourse,
  DraftLicence,
  DraftMember,
  DraftNotification,
} from './model';
import { randomFor } from './random';
import { buildNewcomer, instructorFor } from './roster';
import { ShowcaseWorld } from './world';

const MINUTE = 60_000;

// What a refresh makes happen to the members between the last refresh and
// now: licences renewed (a few let lapse), new students when others finish
// the syllabus.

// ---------- Licences ----------

// One licence in this many is let lapse by its holder, renewed weeks later:
// the office's licence alerts always have something to show, as in a new
// showcase.
export const LAPSE_SHARE = 0.15;
// A licence (rating, medical) is renewed for two years.
export const RENEWAL_MONTHS = 24;

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

// When the holder renews a licence: a few days before it expires, or for a
// few (never the staff nor the presentation accounts), weeks after it
// lapsed. A licence already expired is one let lapse.
export const renewalOf = (
  seed: number,
  member: DraftMember,
  licence: DraftLicence,
): { at: Date; lapses: boolean } => {
  const expiry = licence.expiration_date;
  const rng = randomFor(
    seed,
    'licence',
    licence.id ?? licence.license_number,
    expiry.toISOString(),
  );
  // Drawn whatever the licence's status, so that marking it expired does
  // not change the day it is renewed.
  const unlucky = rng.chance(LAPSE_SHARE);
  const mayLapse = member.kind === 'pilot' && !member.login;
  const lapses = licence.status === 'expired' || (mayLapse && unlucky);
  const days = lapses ? rng.int(30, 120) : -rng.int(3, 25);
  return {
    at: new Date(
      clubDayStart(expiry, days).getTime() + rng.int(9 * 60, 18 * 60) * MINUTE,
    ),
    lapses,
  };
};

export interface LicenceChange {
  licence: DraftLicence;
  renewed: boolean;
  // Marked expired, as the API's nightly job does.
  lapsed: boolean;
}

export interface LicencePlan {
  changes: LicenceChange[];
  adminActions: DraftAdminAction[];
  notifications: DraftNotification[];
}

// Past its date, a licence is marked expired and its holder told, as the
// API's nightly job does.
const markExpired = (
  plan: LicencePlan,
  member: DraftMember,
  licence: DraftLicence,
  since: number,
  now: Date,
) => {
  const expiry = licence.expiration_date;
  licence.status = 'expired';
  licence.is_valid = false;
  const told = new Date(
    Math.max(clubDayStart(expiry, 1).getTime(), since + MINUTE),
  );
  if (told.getTime() > now.getTime()) return;
  plan.notifications.push({
    member,
    type: 'LICENSE_EXPIRED',
    message: () =>
      translate('fr', 'notification.licenceExpired', {
        licenceType: licence.license_type,
      }),
    date: told,
    read: false,
    priority: null,
    expiration: expiry,
  });
};

// The holder sends the renewed licence, the office validates it.
const renew = (
  plan: LicencePlan,
  member: DraftMember,
  licence: DraftLicence,
  at: Date,
  lapsed: boolean,
  office: DraftMember | undefined,
) => {
  const expiry = licence.expiration_date;
  licence.previousExpiry ??= expiry;
  licence.renewedAt = at;
  licence.issue_date = clubDayStart(at);
  licence.expiration_date = addMonths(
    lapsed ? licence.issue_date : expiry,
    RENEWAL_MONTHS,
  );
  licence.status = 'active';
  licence.is_valid = true;
  licence.reminderDays = null;
  if (!office) return;
  plan.adminActions.push({
    actor: office,
    at,
    action: ADMIN_ACTION.LICENCE_VALIDATED,
    targetType: 'licence',
    targetId: () => String(licence.id),
    targetLabel: `${licence.license_type} ${licence.license_number}`,
    summary: () => ({
      memberId: String(member.id),
      from: 'pending',
      to: 'active',
    }),
  });
};

// The licences that expired or were renewed since the last refresh, changed
// in place (the bookings planned after see them as they are now).
export const planLicences = (world: ShowcaseWorld, now: Date): LicencePlan => {
  const plan: LicencePlan = {
    changes: [],
    adminActions: [],
    notifications: [],
  };
  const office = world.members.find((m) => m.kind === 'office');
  const since = world.since.getTime();
  for (const member of world.members) {
    for (const licence of member.licences) {
      const change: LicenceChange = { licence, renewed: false, lapsed: false };
      // Two years at a time: a long absence may see more than one.
      for (let round = 0; round < 3; round++) {
        const { at, lapses } = renewalOf(world.seed, member, licence);
        const renewedAt = new Date(Math.max(at.getTime(), since + HOUR));
        const expired =
          licence.expiration_date.getTime() <=
          Math.min(now.getTime(), renewedAt.getTime());
        if (licence.status !== 'expired' && expired) {
          markExpired(plan, member, licence, since, now);
          change.lapsed = true;
        }
        if (renewedAt.getTime() > now.getTime()) break;
        renew(plan, member, licence, renewedAt, lapses, office);
        change.renewed = true;
      }
      if (change.renewed || change.lapsed) plan.changes.push(change);
    }
  }
  return plan;
};

// ---------- New students ----------

// The day a student passed the last lesson of the syllabus, or null.
export const finishedOn = (
  student: DraftMember,
  courses: DraftCourse[],
): Date | null => {
  const last = courses.find(
    (c) =>
      c.student === student &&
      c.lesson === LESSONS.length - 1 &&
      c.status === 'COMPLETED' &&
      c.competencies.every((k) => k.validated),
  );
  return last ? last.end : null;
};

// The account a new student opens on joining.
export const OPENING_TOP_UPS = [400, 600, 800];

// A student who finished is followed, a few weeks later, by a new one; at
// most one joins every few days. Those who joined at earlier refreshes are
// the first in that order (world.newcomers of them).
export const planNewcomers = (
  world: ShowcaseWorld,
  courses: DraftCourse[],
  now: Date,
): DraftMember[] => {
  if (!world.instruction) return [];
  const finished = world.members
    .filter((m) => m.kind === 'student')
    .flatMap((student) => {
      const on = finishedOn(student, courses);
      if (!on) return [];
      const rng = randomFor(world.seed, 'newcomer', student.id ?? student.key);
      const due =
        clubDayStart(on, rng.int(7, 35)).getTime() + rng.int(9, 18) * HOUR;
      return [{ student, due }];
    })
    .sort((a, b) => a.due - b.due || (a.student.id ?? 0) - (b.student.id ?? 0));

  const taken = new Set([
    ...world.emails,
    ...world.members.map((m) => m.email.toLowerCase()),
  ]);
  const joined: DraftMember[] = [];
  let earliest = world.since.getTime() + HOUR;
  for (const { student, due } of finished.slice(world.newcomers)) {
    const at = Math.max(due, earliest);
    if (at > now.getTime() - HOUR) break;
    const rng = randomFor(world.seed, 'newcomer', student.id ?? student.key, 1);
    const member = buildNewcomer(
      rng,
      `newcomer-${student.key}`,
      new Date(at),
      taken,
    );
    taken.add(member.email.toLowerCase());
    member.bookableFrom = new Date(at + HOUR);
    member.instructor = instructorFor(
      world.members,
      (m) => !finishedOn(m, courses),
    );
    joined.push(member);
    world.members.push(member);
    earliest = at + rng.int(4, 10) * DAY;
  }
  return joined;
};
