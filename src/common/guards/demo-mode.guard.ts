import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';

const ALLOWED_MUTATIONS = ['login', 'logout'];

@Injectable()
export class DemoModeGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const isDemoMode =
      this.configService.get<string>('DEMO_MODE') === 'true';

    if (!isDemoMode) {
      return true;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();

    if (info?.parentType?.name === 'Mutation') {
      const mutationName = info.fieldName;

      if (ALLOWED_MUTATIONS.includes(mutationName)) {
        return true;
      }

      throw new ForbiddenException(
        'Mode démonstration : les modifications sont désactivées.',
      );
    }

    return true;
  }
}
