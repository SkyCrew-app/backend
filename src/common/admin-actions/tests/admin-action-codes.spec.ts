import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { ADMIN_ACTION_NAMES, ADMIN_TARGET_TYPES } from '../admin-actions';

// The interface names every action and every target of the log in French
// and English (frontend/src/lib/admin-actions.ts, ADMIN_ACTION_CODES and
// ADMIN_TARGET_TYPES, checked against its locale files). These lists are the
// same: a code added here without its wording there shows raw on the screen.
const LABELLED_ACTIONS = [
  'balance.adjusted',
  'payment.status_changed',
  'payment.refund_recorded',
  'member.role_changed',
  'member.deactivated',
  'member.reactivated',
  'member.deleted',
  'member.invitation_resent',
  'settings.changed',
  'settings.maintenance_toggled',
  'incident.status_changed',
  'incident.deleted',
  'role.created',
  'role.renamed',
  'role.deleted',
  'reservation.changed_for_member',
  'reservation.cancelled_for_member',
  'flight.record_amended',
  'flight.record_deleted',
  'aircraft.grounded',
  'aircraft.returned_to_service',
  'aircraft.deleted',
  'aircraft.retired',
  'licence.validated',
];

const LABELLED_TARGETS = [
  'member',
  'payment',
  'settings',
  'incident',
  'role',
  'reservation',
  'flight',
  'aircraft',
  'licence',
];

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === 'tests' ? [] : sources(path);
    }
    return /\.ts$/.test(entry) && !/\.spec\.ts$/.test(entry) ? [path] : [];
  });

describe('codes of the administrators’ log', () => {
  it('records only actions the interface has a wording for', () => {
    expect([...ADMIN_ACTION_NAMES].sort()).toEqual(
      [...LABELLED_ACTIONS].sort(),
    );
  });

  it('records only targets the interface has a wording for', () => {
    expect([...ADMIN_TARGET_TYPES].sort()).toEqual(
      [...LABELLED_TARGETS].sort(),
    );
  });

  // The types already refuse a code outside these lists; this also catches
  // a cast or a code built at run time.
  it('passes a known code to every call that writes a line', () => {
    const root = join(__dirname, '..', '..', '..');
    const calls = sources(root).flatMap((file) =>
      [
        ...readFileSync(file, 'utf8').matchAll(
          /adminActions\.record\(\s*[\w?.]+,\s*([^,]+),/g,
        ),
      ].map((match) => ({ file, action: match[1].trim() })),
    );
    expect(calls.length).toBeGreaterThan(20);
    for (const { file, action } of calls) {
      // A constant of ADMIN_ACTION, a choice between two, or a parameter
      // typed AdminActionName.
      expect({ file, action }).toEqual({
        file,
        action: expect.stringMatching(
          /^(ADMIN_ACTION\.\w+|action|\w+\s*\?\s*ADMIN_ACTION\.\w+\s*:\s*ADMIN_ACTION\.\w+)$/,
        ),
      });
    }
  });
});
