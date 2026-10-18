import { Args, Field, Int, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ROLE_ADMIN, SessionUser } from '../auth/access';
import { LoginEvent } from './login-event.entity';
import { LoginEventsService } from './login-events.service';
import { LoginOutcome } from './login-events';

@ObjectType()
export class LoginEventsPage {
  @Field(() => [LoginEvent])
  items: LoginEvent[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  pageSize: number;
}

// Reading the connection log. Nothing here writes: lines are added by the
// sign-in itself.
@Resolver(() => LoginEvent)
export class LoginEventsResolver {
  constructor(private readonly loginEvents: LoginEventsService) {}

  // Every sign-in of the club, for administrators.
  @Query(() => LoginEventsPage, { name: 'loginEvents' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_ADMIN)
  loginEventsPage(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('pageSize', { type: () => Int, nullable: true }) pageSize?: number,
    @Args('memberId', { type: () => Int, nullable: true }) memberId?: number,
    @Args('outcome', { type: () => LoginOutcome, nullable: true })
    outcome?: LoginOutcome,
    @Args('from', {
      type: () => Date,
      nullable: true,
      description: 'From this moment, included.',
    })
    from?: Date,
    @Args('to', {
      type: () => Date,
      nullable: true,
      description: 'Up to this moment, excluded.',
    })
    to?: Date,
  ): Promise<LoginEventsPage> {
    return this.loginEvents.find({
      page,
      pageSize,
      memberId,
      outcome,
      from,
      to,
    });
  }

  // The latest sign-ins on the account of the member asking, whoever they
  // are: the account is taken from the session, never from an argument.
  @Query(() => [LoginEvent], { name: 'myLoginEvents' })
  @UseGuards(JwtAuthGuard)
  async myLoginEvents(
    @CurrentUser() user?: SessionUser,
  ): Promise<LoginEvent[]> {
    if (!user?.id) {
      throw new UnauthorizedException();
    }
    return this.loginEvents.forMember(Number(user.id));
  }
}
