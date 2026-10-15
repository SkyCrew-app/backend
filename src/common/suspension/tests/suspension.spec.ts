import { isSuspendedValue } from '../suspension';
import { SuspensionService } from '../suspension.service';

describe('isSuspendedValue', () => {
  it.each(['1', 'true', 'TRUE', 'yes', ' 1 '])('suspends on %p', (value) => {
    expect(isSuspendedValue(value)).toBe(true);
  });

  it.each([undefined, '', '0', 'false', 'no', 'oui', '2'])(
    'does not suspend on %p',
    (value) => {
      expect(isSuspendedValue(value)).toBe(false);
    },
  );
});

describe('SuspensionService', () => {
  const saved = process.env.SKYCREW_SUSPENDED;
  afterEach(() => {
    if (saved === undefined) delete process.env.SKYCREW_SUSPENDED;
    else process.env.SKYCREW_SUSPENDED = saved;
  });

  it('reads SKYCREW_SUSPENDED from the environment without configuration', () => {
    process.env.SKYCREW_SUSPENDED = '1';
    expect(new SuspensionService().suspended).toBe(true);
    process.env.SKYCREW_SUSPENDED = '';
    expect(new SuspensionService().suspended).toBe(false);
  });

  it('builds a service in a given state for tests', () => {
    expect(SuspensionService.of(true).suspended).toBe(true);
    expect(SuspensionService.of(false).suspended).toBe(false);
  });
});
