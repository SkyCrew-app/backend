import { Global, Module } from '@nestjs/common';
import { LoginEventsService } from './login-events.service';
import { LoginEventsResolver } from './login-events.resolver';

// Global: the sign-in, the rate limit and the nightly purge all reach the
// log without importing it.
@Global()
@Module({
  providers: [LoginEventsService, LoginEventsResolver],
  exports: [LoginEventsService],
})
export class LoginEventsModule {}
