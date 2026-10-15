import { Global, Module } from '@nestjs/common';
import { SuspensionGuard } from './suspension.guard';
import { SuspensionResolver } from './suspension.resolver';
import { SuspensionService } from './suspension.service';

@Global()
@Module({
  providers: [SuspensionService, SuspensionResolver, SuspensionGuard],
  exports: [SuspensionService, SuspensionGuard],
})
export class SuspensionModule {}
