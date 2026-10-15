// An installation can be suspended by the SkyCrew provider, for instance when
// the club's subscription is unpaid: SKYCREW_SUSPENDED=1 in its environment.
// While suspended, the web application shows a "service suspended" page, the
// API refuses every change and nothing is deleted. Removing the flag (and
// restarting) gives everything back as it was.
export const SUSPENDED_ENV = 'SKYCREW_SUSPENDED';

// Mutations still allowed while suspended: leaving a session changes nothing.
export const ALLOWED_WHILE_SUSPENDED: readonly string[] = ['logout'];

// "1", "true" or "yes" (any case) suspend; anything else, or nothing, does not.
export const isSuspendedValue = (value: string | undefined): boolean =>
  value !== undefined && /^(1|true|yes)$/i.test(value.trim());
