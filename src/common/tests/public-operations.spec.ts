import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Every operation requires a session unless it is marked @Public().
// This list is the complete set of public entry points: opening a new one
// has to be a deliberate change to this file.
const EXPECTED_PUBLIC_OPERATIONS = [
  'app.controller.ts: AppController (class)',
  'app.resolver.ts: hello',
  'common/controllers/webhook.controller.ts: WebhookController (class)',
  'modules/administration/administration.resolver.ts: getMaintenanceDetails',
  'modules/administration/administration.resolver.ts: getSiteStatus',
  'modules/auth/auth.resolver.ts: getEmailFromCookie',
  'modules/auth/auth.resolver.ts: login',
  'modules/auth/auth.resolver.ts: logout',
  'modules/auth/auth.resolver.ts: verify2FA',
  'modules/health/health.controller.ts: HealthController (class)',
  'modules/metrics/metrics.controller.ts: index',
  'modules/users/users.resolver.ts: confirmEmailAndSetPassword',
];

const sourceRoot = join(__dirname, '..', '..');

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(resolver|controller|gateway)\.ts$/.test(entry) ? [path] : [];
  });

const publicOperations = (): string[] =>
  sourceFiles(sourceRoot)
    .flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      const found: string[] = [];

      lines.forEach((line, index) => {
        if (line.trim() !== '@Public()') {
          return;
        }

        // The decorated declaration is the next line that is not a
        // decorator or a comment.
        const declaration = lines
          .slice(index + 1)
          .map((next) => next.trim())
          .find(
            (next) =>
              next !== '' &&
              !next.startsWith('@') &&
              !next.startsWith('//') &&
              !/^[\w'",\s{}:()=>[\]]*\)$/.test(next),
          );

        const classMatch = declaration?.match(/^export class (\w+)/);
        const methodMatch = declaration?.match(/^(?:async\s+)?(\w+)\s*\(/);
        const name = classMatch
          ? `${classMatch[1]} (class)`
          : (methodMatch?.[1] ?? `unrecognised: ${declaration}`);

        found.push(`${relative(sourceRoot, file)}: ${name}`);
      });

      return found;
    })
    .sort();

describe('public operations', () => {
  it('are exactly the ones listed here', () => {
    expect(publicOperations()).toEqual(EXPECTED_PUBLIC_OPERATIONS);
  });
});
