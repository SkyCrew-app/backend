import { Args, Field, Int, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ROLE_ADMIN } from '../auth/access';
import { AdminAction } from './admin-action.entity';
import { AdminActionsService } from './admin-actions.service';
import { ADMIN_ACTION_NAMES } from './admin-actions';

@ObjectType()
export class AdminActionsPage {
  @Field(() => [AdminAction])
  items: AdminAction[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  pageSize: number;
}

// Reading the trace is for administrators. Nothing here writes: lines are
// added by the operations themselves.
@Resolver(() => AdminAction)
export class AdminActionsResolver {
  constructor(private readonly adminActions: AdminActionsService) {}

  @Query(() => AdminActionsPage, { name: 'adminActions' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_ADMIN)
  adminActionsPage(
    @Args('memberId', { type: () => Int, nullable: true }) memberId?: number,
    @Args('action', { type: () => String, nullable: true }) action?: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('pageSize', { type: () => Int, nullable: true }) pageSize?: number,
  ): Promise<AdminActionsPage> {
    return this.adminActions.find({ memberId, action, page, pageSize });
  }

  // The action names the trace can hold, for the filter of the page.
  @Query(() => [String], { name: 'adminActionNames' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_ADMIN)
  adminActionNames(): string[] {
    return ADMIN_ACTION_NAMES;
  }
}
