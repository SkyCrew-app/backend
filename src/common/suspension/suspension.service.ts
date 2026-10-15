import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isSuspendedValue, SUSPENDED_ENV } from './suspension';

// Read once when the API starts: suspending or resuming means changing the
// environment and restarting, like the plan.
@Injectable()
export class SuspensionService {
  readonly suspended: boolean;

  constructor(@Optional() configService?: ConfigService) {
    this.suspended = isSuspendedValue(
      configService?.get<string>(SUSPENDED_ENV) ?? process.env[SUSPENDED_ENV],
    );
  }

  // For tests: a service in a given state.
  static of(suspended: boolean): SuspensionService {
    return new SuspensionService({
      get: () => (suspended ? '1' : ''),
    } as unknown as ConfigService);
  }
}
