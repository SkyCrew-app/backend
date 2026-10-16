import { Random } from './random';
import { DAY } from './calendar';
import {
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  LAST_NAMES,
  SHOWCASE_EMAIL_DOMAIN,
  STREETS,
  TOWNS,
} from './content';
import { DraftLicence, DraftMember, MemberKind } from './model';

export const ROSTER_SIZE = {
  office: 2,
  instructor: 3,
  technician: 1,
  pilot: 42,
  student: 10,
} as const;

export interface LicenceTypes {
  pilot: string;
  light: string;
  instructor: string;
}

// The licence types the showcase gives, among those the club accepts (an
// empty list accepts all): PPL, LAPL for a few pilots, CPL for instructors.
export const licenceTypesFor = (accepted: string[] | null | undefined) => {
  const list = (accepted ?? []).map((type) => String(type).trim());
  const accepts = (type: string) => list.length === 0 || list.includes(type);
  const pilot = accepts('PPL') ? 'PPL' : (list[0] ?? 'PPL');
  return {
    pilot,
    light: accepts('LAPL') ? 'LAPL' : pilot,
    instructor: accepts('CPL') ? 'CPL' : pilot,
  };
};

const ascii = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '');

const yearsAgo = (now: Date, years: number, rng: Random) =>
  new Date(now.getTime() - (years * 365.25 + rng.int(0, 360)) * DAY);

// Licence expiries that the showcase shows: one expired, a few expiring
// soon (days from now). The others expire in 3 to 24 months.
export const EXPIRED_LICENCE_DAYS = -18;
export const EXPIRING_SOON_DAYS = [5, 19, 41];

// The reminder step (days before expiry) already sent for a licence with
// this many days left: the API sends 60, 30 and 7 days before.
export const sentReminderStep = (daysLeft: number): number | null =>
  daysLeft < 0
    ? 7
    : daysLeft <= 7
      ? 7
      : daysLeft <= 30
        ? 30
        : daysLeft <= 60
          ? 60
          : null;

export const buildRoster = (
  rng: Random,
  now: Date,
  historyStart: Date,
  accepted: string[] | null | undefined,
  instruction: boolean,
): DraftMember[] => {
  const types = licenceTypesFor(accepted);
  const used = new Set<string>();
  const members: DraftMember[] = [];
  let licenceSerial = rng.int(1200, 4800);

  const name = (): { first: string; last: string } => {
    for (;;) {
      const female = rng.chance(0.28);
      const first = rng.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
      const last = rng.pick(LAST_NAMES);
      const key = `${ascii(first)}.${ascii(last)}`;
      if (!used.has(key)) {
        used.add(key);
        return { first, last };
      }
    }
  };

  const licence = (
    member: DraftMember,
    type: string,
    expiresInDays: number,
  ): DraftLicence => {
    licenceSerial += rng.int(3, 41);
    const expiration = new Date(now.getTime() + expiresInDays * DAY);
    const issue = new Date(
      Math.min(
        member.joined.getTime(),
        now.getTime() - rng.int(400, 4000) * DAY,
      ),
    );
    const expired = expiration.getTime() < now.getTime();
    return {
      member,
      license_type: type,
      license_number: `FRA.FCL.${type}.DEMO${String(licenceSerial).padStart(5, '0')}`,
      issue_date: issue,
      expiration_date: expiration,
      status: expired ? 'expired' : 'active',
      is_valid: !expired,
      reminderDays: sentReminderStep(expiresInDays),
    };
  };

  const add = (
    kind: MemberKind,
    options: {
      ageMin: number;
      ageMax: number;
      hours: [number, number];
      licence?: string | null;
      joinedDaysAgo?: number;
      activity?: number;
    },
  ): DraftMember => {
    const { first, last } = name();
    const [town, postcode] = rng.pick(TOWNS);
    const joinedDaysAgo = options.joinedDaysAgo ?? rng.int(200, 365 * 15);
    const priorHours =
      Math.round(rng.int(options.hours[0], options.hours[1]) * 10) / 10;
    const member: DraftMember = {
      key: `${kind}-${members.length + 1}`,
      kind,
      first_name: first,
      last_name: last,
      email: `${ascii(first)}.${ascii(last)}@${SHOWCASE_EMAIL_DOMAIN}`,
      phone: `+33 6 39 98 ${String(rng.int(0, 99)).padStart(2, '0')} ${String(rng.int(0, 99)).padStart(2, '0')}`,
      address: `${rng.int(1, 140)} ${rng.pick(STREETS)}, ${postcode} ${town}`,
      birth: yearsAgo(now, rng.int(options.ageMin, options.ageMax), rng),
      joined: new Date(now.getTime() - joinedDaysAgo * DAY),
      priorHours,
      experienced: priorHours >= 250,
      activity: options.activity ?? rng.int(1, 10),
      licences: [],
      balanceCents: 0,
      closedHours: 0,
    };
    if (options.licence) {
      member.licences.push(licence(member, options.licence, rng.int(90, 730)));
    }
    members.push(member);
    return member;
  };

  for (let i = 0; i < ROSTER_SIZE.office; i++) {
    add('office', {
      ageMin: 45,
      ageMax: 68,
      hours: [400, 1800],
      licence: types.pilot,
      activity: 4,
    });
  }
  const instructors: DraftMember[] = [];
  for (let i = 0; i < ROSTER_SIZE.instructor; i++) {
    const instructor = add(instruction ? 'instructor' : 'pilot', {
      ageMin: 28,
      ageMax: 62,
      hours: [900, 4500],
      licence: types.instructor,
      activity: 3,
    });
    instructor.experienced = true;
    instructors.push(instructor);
  }
  add('technician', { ageMin: 30, ageMax: 58, hours: [0, 0], activity: 0 });

  const pilots: DraftMember[] = [];
  for (let i = 0; i < ROSTER_SIZE.pilot; i++) {
    // A few joined during the history: their account starts then.
    const recent = i % 9 === 4;
    pilots.push(
      add('pilot', {
        ageMin: 19,
        ageMax: 74,
        hours: recent ? [60, 160] : rng.chance(0.3) ? [300, 1600] : [70, 320],
        licence: i % 7 === 3 ? types.light : types.pilot,
        joinedDaysAgo: recent
          ? rng.int(
              40,
              Math.max(
                41,
                Math.floor((now.getTime() - historyStart.getTime()) / DAY) - 10,
              ),
            )
          : undefined,
      }),
    );
  }

  if (instruction) {
    for (let i = 0; i < ROSTER_SIZE.student; i++) {
      const student = add('student', {
        ageMin: 16,
        ageMax: 48,
        hours: [0, 0],
        joinedDaysAgo: rng.int(
          25,
          Math.floor((now.getTime() - historyStart.getTime()) / DAY) + 60,
        ),
        activity: 0,
      });
      student.instructor = instructors[i % instructors.length];
    }
  }

  // The licences the showcase shows: one expired, a few expiring soon.
  const flyers = pilots.filter(
    (p) => p.joined.getTime() < historyStart.getTime(),
  );
  const special = [EXPIRED_LICENCE_DAYS, ...EXPIRING_SOON_DAYS];
  special.forEach((days, index) => {
    const pilot = flyers[3 + index * 5];
    pilot.licences = [licence(pilot, pilot.licences[0].license_type, days)];
  });

  // The presentation accounts: an active pilot with a valid licence, a
  // student, their instructor and the technician.
  const specialPilots = new Set(
    special.map((_, index) => flyers[3 + index * 5]),
  );
  const loginPilot = flyers.find(
    (p) =>
      !specialPilots.has(p) &&
      p.experienced &&
      p.licences[0].license_type === types.pilot,
  );
  if (loginPilot) {
    loginPilot.login = 'pilot';
    loginPilot.activity = 10;
  }
  const student = members.find((m) => m.kind === 'student');
  if (student) {
    student.login = 'student';
    // Enrolled early enough to show a long progression.
    student.joined = new Date(historyStart.getTime() - 20 * DAY);
    student.instructor!.login = 'instructor';
  } else {
    instructors[0].login = 'instructor';
  }
  members.find((m) => m.kind === 'technician')!.login = 'technician';
  return members;
};
