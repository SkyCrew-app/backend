import { Global, Module } from '@nestjs/common';
import { AdminActionsService } from './admin-actions.service';
import { AdminActionsResolver } from './admin-actions.resolver';

// Global: any module records an administrator action by injecting
// AdminActionsService. The modules that already do also import it, so each
// of them still stands on its own.
@Global()
@Module({
  providers: [AdminActionsService, AdminActionsResolver],
  exports: [AdminActionsService],
})
export class AdminActionsModule {}
