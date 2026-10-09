import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    // Plain HTTP routes (files, webhooks…) carry the request directly.
    if (typeof context.getType === 'function' && context.getType() === 'http') {
      return context.switchToHttp().getRequest();
    }

    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
