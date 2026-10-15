import { Query, Resolver } from '@nestjs/graphql';
import { Public } from '../decorators/public.decorator';
import { SuspensionService } from './suspension.service';

@Resolver()
export class SuspensionResolver {
  constructor(private readonly suspension: SuspensionService) {}

  // Read by the web application before any login, to show the
  // "service suspended" page.
  @Public()
  @Query(() => Boolean, { name: 'serviceSuspended' })
  serviceSuspended(): boolean {
    return this.suspension.suspended;
  }
}
