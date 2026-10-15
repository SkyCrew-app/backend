import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { localized } from '../i18n/localized-exception';
import { ALLOWED_WHILE_SUSPENDED } from './suspension';
import { SuspensionService } from './suspension.service';

// Global guard: while the installation is suspended, every GraphQL mutation
// is refused (reading stays possible, nothing is deleted). REST routes are
// left alone: the payment webhooks of the club must keep being recorded.
@Injectable()
export class SuspensionGuard implements CanActivate {
  constructor(private readonly suspension: SuspensionService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.suspension.suspended || context.getType<string>() !== 'graphql') {
      return true;
    }
    const info = GqlExecutionContext.create(context).getInfo();
    if (
      info?.parentType?.name === 'Mutation' &&
      !ALLOWED_WHILE_SUSPENDED.includes(info.fieldName)
    ) {
      throw localized(ForbiddenException, 'error.service.suspended');
    }
    return true;
  }
}
