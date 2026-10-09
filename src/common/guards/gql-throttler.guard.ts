import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

// Limits apply per client address. Attach it, with @Throttle, to the
// operations that accept a secret (password, one-time code, token).
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const { req, res } = GqlExecutionContext.create(context).getContext();
    return { req, res };
  }
}

// At most 10 attempts a minute, and no burst above 3 a second.
export const SECRET_ATTEMPT_LIMITS = {
  short: { limit: 3, ttl: 1000 },
  medium: { limit: 5, ttl: 10000 },
  long: { limit: 10, ttl: 60000 },
};
