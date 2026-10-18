import { ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { LoginEventsService } from '../login-events/login-events.service';
import { LoginMethod } from '../login-events/login-events';

// The sign-in steps whose refused attempts go to the connection log, with
// what they check and where the address typed is.
const SIGN_IN_STEPS: Record<
  string,
  { method: LoginMethod; email: (args: any) => string | undefined }
> = {
  login: {
    method: LoginMethod.PASSWORD,
    email: (args) => args?.loginInput?.email,
  },
  verify2FA: {
    method: LoginMethod.TWO_FACTOR_CODE,
    email: (args) => args?.email,
  },
};

// Limits apply per client address. Attach it, with @Throttle, to the
// operations that accept a secret (password, one-time code, token).
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Optional() private readonly loginEvents?: LoginEventsService,
  ) {
    super(options, storageService, reflector);
  }

  getRequestResponse(context: ExecutionContext) {
    const { req, res } = GqlExecutionContext.create(context).getContext();
    return { req, res };
  }

  // A sign-in refused for too many attempts is logged before it is refused.
  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    try {
      const gql = GqlExecutionContext.create(context);
      const step = SIGN_IN_STEPS[gql.getInfo()?.fieldName];
      if (step && this.loginEvents) {
        await this.loginEvents.recordThrottled({
          method: step.method,
          email: step.email(gql.getArgs()),
          req: gql.getContext()?.req,
        });
      }
    } catch {
      // The refusal below matters more than the log.
    }
    return super.throwThrottlingException(context, detail);
  }
}

// At most 10 attempts a minute, and no burst above 3 a second.
export const SECRET_ATTEMPT_LIMITS = {
  short: { limit: 3, ttl: 1000 },
  medium: { limit: 5, ttl: 10000 },
  long: { limit: 10, ttl: 60000 },
};
