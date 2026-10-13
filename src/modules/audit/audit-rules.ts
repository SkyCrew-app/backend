import { AuditResultType } from './enums/audit-result.enum';

// Audit results that take the aircraft out of service as soon as they are
// recorded, the way a severe incident does (see incidents/incident-rules).
// It stays grounded until an administrator or a technician puts it back.
export const GROUNDING_AUDIT_RESULTS: AuditResultType[] = [
  AuditResultType.NON_CONFORME,
];

export const auditGroundsAircraft = (
  result: AuditResultType | string | null | undefined,
): boolean =>
  result != null &&
  (GROUNDING_AUDIT_RESULTS as string[]).includes(String(result));
