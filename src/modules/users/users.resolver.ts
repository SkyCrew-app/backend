import { Resolver, Query, Mutation, Args, Context, Int } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './entity/users.entity';
import {
  BadRequestException,
  ForbiddenException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import {
  GqlThrottlerGuard,
  SECRET_ATTEMPT_LIMITS,
} from '../../common/guards/gql-throttler.guard';
import { Throttle } from '@nestjs/throttler';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdateUserPreferencesInput } from './dto/update-user-preferences.input';
import { DashboardWidgetConfigInput } from './dto/dashboard-widget-config.type';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { saveUploadToTmp } from '../../common/uploads/save-upload';
import { EvalService } from '../eval/eval.service';
import { Evaluation } from '../eval/entity/evaluation.entity';
import { UserProgress } from './entity/user-progress.entity';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  assertSelfOrRole,
  hasRole,
  isAdmin,
  ROLE_INSTRUCTOR,
} from '../../common/auth/access';
import {
  DEFAULT_LANGUAGE,
  Language,
  languageOf,
  LANGUAGES,
  parseLanguage,
} from '../../common/i18n/languages';
import { RequestLanguage } from '../../common/i18n/request-language';
import { normalizeEmail } from '../../common/validation/email';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';
import {
  InstructorRoleChangeOutcome,
  InstructorRoleChangeService,
} from './instructor-role-change.service';

const memberTarget = (
  id: number,
  user?: { first_name?: string; last_name?: string; email?: string } | null,
) => ({
  type: 'member' as const,
  id,
  label:
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    null,
});

@Resolver(() => User)
@UseFilters(LocalizedExceptionFilter)
export class UsersResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminActions: AdminActionsService,
    private readonly instructorRoleChange?: InstructorRoleChangeService,
  ) {}

  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  getUsers() {
    return this.usersService.findAll();
  }

  // The club directory: every member sees the name, contact and role of the
  // others, which is what booking a course or reaching someone requires.
  @Query(() => [User])
  @UseGuards(JwtAuthGuard)
  async membersDirectory() {
    const users = await this.usersService.findAll();
    // A deactivated member is no longer someone to book a course with.
    return users
      .filter((user) => user.is_active !== false)
      .map((user) => this.directoryEntry(user));
  }

  // A member who leaves is deactivated: they can no longer sign in, and
  // everything they did stays. Reversible.
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async setUserActive(
    @Args('id', { type: () => Int }) id: number,
    @Args('active') active: boolean,
    @CurrentUser() currentUser?: User,
  ): Promise<User> {
    const user = await this.usersService.setActive(id, active);
    await this.adminActions.record(
      currentUser,
      active
        ? ADMIN_ACTION.MEMBER_REACTIVATED
        : ADMIN_ACTION.MEMBER_DEACTIVATED,
      memberTarget(id, user),
    );
    return user;
  }

  // Refused for a member with any history: see setUserActive.
  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async deleteUser(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: User,
  ): Promise<boolean> {
    // Read first: once deleted, the trace could no longer name the member.
    const user = await this.usersService.findOneById(id);
    const deleted = await this.usersService.remove(id);
    await this.adminActions.record(
      currentUser,
      ADMIN_ACTION.MEMBER_DELETED,
      memberTarget(id, user),
      { email: user?.email ?? null },
    );
    return deleted;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async resendInvitation(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: User,
  ): Promise<boolean> {
    const sent = await this.usersService.resendInvitation(id);
    await this.adminActions.record(
      currentUser,
      ADMIN_ACTION.INVITATION_RESENT,
      memberTarget(id, await this.usersService.findOneById(id)),
    );
    return sent;
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  createUser(
    @Args('first_name') first_name: string,
    @Args('last_name') last_name: string,
    @Args('email') email: string,
    @Args('date_of_birth') date_of_birth: Date,
    @Args('language', { nullable: true }) language?: string,
    @RequestLanguage() requestLanguage?: Language,
    @Args('roleId', { type: () => Int, nullable: true }) roleId?: number,
  ) {
    // Unless told otherwise, the new member is written to in the language
    // the administrator is working in.
    return this.usersService.create(
      {
        first_name,
        last_name,
        email,
        date_of_birth,
        language:
          parseLanguage(language) ?? requestLanguage ?? DEFAULT_LANGUAGE,
      },
      roleId ?? undefined,
    );
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  async userByEmail(
    @Args('email') email: string,
    @CurrentUser() currentUser?: User,
  ) {
    const user = await this.usersService.findOneByEmail(email);
    return this.visibleTo(currentUser, user);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @Args({ name: 'image', type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
    @CurrentUser() currentUser?: User,
  ): Promise<User> {
    const asAdmin = isAdmin(currentUser);
    const requestedEmail = updateUserInput.email;

    if (
      !asAdmin &&
      requestedEmail &&
      normalizeEmail(requestedEmail) !== normalizeEmail(currentUser.email)
    ) {
      throw new ForbiddenException('You can only update your own account');
    }

    const targetEmail = asAdmin
      ? requestedEmail || currentUser.email
      : currentUser.email;

    let imagePath: string | null = null;

    if (image) {
      imagePath = await saveUploadToTmp(image, 'picture');
    }

    // Only a role change is traced: the rest of a profile is the member's.
    const previous =
      asAdmin && updateUserInput.roleId
        ? await this.usersService.findOneByEmail(targetEmail)
        : null;

    // An instructor's bookings and courses do not outlive the role: the
    // change is refused while they exist, or settles them when confirmed.
    let settled: InstructorRoleChangeOutcome | null = null;
    const updated = await this.usersService.updateUser(
      targetEmail,
      updateUserInput,
      imagePath,
      {
        asAdmin,
        beforeRoleChange: async (member, role) => {
          if (!this.instructorRoleChange) {
            return;
          }
          settled = await this.instructorRoleChange.settle(
            member,
            role,
            updateUserInput.cancelInstructionCommitments === true,
          );
        },
      },
    );

    const previousRole = previous?.role?.role_name ?? null;
    const newRole = updated?.role?.role_name ?? null;
    if (previous && newRole !== previousRole) {
      const outcome = settled as InstructorRoleChangeOutcome | null;
      await this.adminActions.record(
        currentUser,
        ADMIN_ACTION.MEMBER_ROLE_CHANGED,
        memberTarget(updated.id, updated),
        {
          from: previousRole,
          to: newRole,
          ...(outcome &&
            (outcome.cancelledInstructionReservations > 0 ||
              outcome.cancelledCourses > 0) &&
            outcome),
        },
      );
    }
    return updated;
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  toggle2FA(
    @Context() context: { req: { user: { email: string } } },
    @Args('is2FAEnabled') is2FAEnabled: boolean,
    // Kept for older clients. The change always applies to the
    // authenticated user, never to an email supplied by the caller.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('email', { nullable: true }) _email?: string,
  ) {
    // Switching it off removes a protection: that goes through disable2FA,
    // which asks for the password.
    if (!is2FAEnabled) {
      throw new ForbiddenException(
        'Pour désactiver la double authentification, confirmez votre mot de passe.',
      );
    }
    return this.usersService.update2FAStatus(
      context.req.user.email,
      is2FAEnabled,
    );
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateNotificationSettings(
    @Args('email_notifications_enabled') email_notifications_enabled: boolean,
    @Args('sms_notifications_enabled') sms_notifications_enabled: boolean,
    @Args('newsletter_subscribed') newsletter_subscribed: boolean,
    @Context() context,
  ) {
    const user = context.req.user;
    return this.usersService.updateNotificationSettings(
      user.id,
      email_notifications_enabled,
      sms_notifications_enabled,
      newsletter_subscribed,
    );
  }

  // The language the signed-in member is written to (e-mails, notifications).
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateMyLanguage(
    @Args('language') language: string,
    @Context() context,
  ) {
    const supported = (LANGUAGES as readonly string[]).includes(language);
    if (!supported) {
      throw new BadRequestException(
        `Unsupported language. Accepted values: ${LANGUAGES.join(', ')}.`,
      );
    }
    return this.usersService.updateLanguage(
      context.req.user.id,
      language as Language,
    );
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, GqlThrottlerGuard)
  @Throttle(SECRET_ATTEMPT_LIMITS)
  async updatePassword(
    @Args('currentPassword') currentPassword: string,
    @Args('newPassword') newPassword: string,
    @Context() context,
  ) {
    const user = context.req.user;
    return this.usersService.updatePassword(
      user.id,
      currentPassword,
      newPassword,
    );
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  async getUserDetails(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: User,
  ) {
    const user = await this.usersService.findOneById(id);
    return this.visibleTo(currentUser, user);
  }

  @Public()
  @UseGuards(GqlThrottlerGuard)
  @Throttle(SECRET_ATTEMPT_LIMITS)
  @Mutation(() => User)
  async confirmEmailAndSetPassword(
    @Args('validation_token') token: string,
    @Args('password') password: string,
  ) {
    return this.usersService.confirmEmailAndSetPassword(token, password);
  }

  // Always answers true: whether the address belongs to a member is not
  // disclosed.
  @Public()
  @UseGuards(GqlThrottlerGuard)
  @Throttle(SECRET_ATTEMPT_LIMITS)
  @Mutation(() => Boolean)
  async requestPasswordReset(@Args('email') email: string): Promise<boolean> {
    await this.usersService.requestPasswordReset(email);
    return true;
  }

  @Public()
  @UseGuards(GqlThrottlerGuard)
  @Throttle(SECRET_ATTEMPT_LIMITS)
  @Mutation(() => Boolean)
  async resetPassword(
    @Args('token') token: string,
    @Args('newPassword') newPassword: string,
  ): Promise<boolean> {
    return this.usersService.resetPassword(token, newPassword);
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  async getUserPreferences(
    @Args('userId') userId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<User> {
    assertSelfOrRole(currentUser, userId);
    return this.usersService.getUserPreferences(userId);
  }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateUserPreferences(
    @Args('userId', { type: () => Number }) userId: number,
    @Args('preference', { type: () => UpdateUserPreferencesInput })
    preference: UpdateUserPreferencesInput,
    @CurrentUser() currentUser?: User,
  ): Promise<User> {
    assertSelfOrRole(currentUser, userId);
    return this.usersService.updateUserPreferences(
      userId,
      preference.language,
      preference.speed_unit,
      preference.distance_unit,
      preference.timezone,
      preference.preferred_aerodrome,
    );
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateDashboardWidgets(
    @Args('userId', { type: () => Int }) userId: number,
    @Args('widgets', { type: () => [DashboardWidgetConfigInput] })
    widgets: DashboardWidgetConfigInput[],
    @CurrentUser() currentUser?: User,
  ): Promise<User> {
    assertSelfOrRole(currentUser, userId);
    return this.usersService.updateDashboardWidgets(userId, widgets);
  }

  // Members see each other's directory entry (name and contact). The full
  // profile is for the user themselves, instructors and administrators.
  private visibleTo(currentUser: User | undefined, user: User | null) {
    if (!user) {
      return user;
    }

    const seesFullProfile =
      Number(currentUser?.id) === Number(user.id) ||
      isAdmin(currentUser) ||
      hasRole(currentUser, ROLE_INSTRUCTOR);

    if (seesFullProfile) {
      return user;
    }

    return this.directoryEntry(user);
  }

  private directoryEntry(user: User) {
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number,
      profile_picture: user.profile_picture,
      role: user.role,
    };
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  me(@Context() context): { id: number; email: string; language: Language } {
    if (!context.req.user) {
      throw new Error('Utilisateur non authentifié');
    }
    return {
      id: context.req.user.id,
      email: context.req.user.email,
      language: languageOf(context.req.user),
    };
  }
}

@Resolver(() => UserProgress)
export class UserProgressResolver {
  constructor(
    private readonly evalService: EvalService,
    private readonly usersService: UsersService,
  ) {}

  // Progress is read by the member, administrators, and an instructor for
  // their own students only.
  private async assertMayReadProgress(
    currentUser: User | undefined,
    userId: number,
  ): Promise<void> {
    const isOwnStudent =
      hasRole(currentUser, ROLE_INSTRUCTOR) &&
      (await this.usersService.isInstructorOf(
        Number(currentUser.id),
        Number(userId),
      ));
    if (!isOwnStudent) {
      assertSelfOrRole(currentUser, userId);
    }
  }

  @Query(() => [Evaluation], { name: 'getUserProgressByEvaluation' })
  @UseGuards(JwtAuthGuard)
  async getUserProgressByEvaluation(
    @Args('userId') userId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<any[]> {
    await this.assertMayReadProgress(currentUser, userId);
    return this.evalService.getUserEvaluationResults(userId);
  }

  @Query(() => Number, { name: 'getCourseProgress' })
  @UseGuards(JwtAuthGuard)
  async getCourseProgress(
    @Args('userId') userId: number,
    @Args('courseId') courseId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<number> {
    await this.assertMayReadProgress(currentUser, userId);
    return this.usersService.getCourseProgress(userId, courseId);
  }

  @Mutation(() => Boolean, { name: 'markLessonStarted' })
  @UseGuards(JwtAuthGuard)
  async markLessonStarted(
    @Args('userId') userId: number,
    @Args('lessonId') lessonId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<boolean> {
    assertSelfOrRole(currentUser, userId);
    await this.usersService.markLessonStarted(userId, lessonId);
    return true;
  }

  @Mutation(() => Boolean, { name: 'markLessonCompleted' })
  @UseGuards(JwtAuthGuard)
  async markLessonCompleted(
    @Args('userId') userId: number,
    @Args('lessonId') lessonId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<boolean> {
    assertSelfOrRole(currentUser, userId);
    await this.usersService.markLessonCompleted(userId, lessonId);
    return true;
  }

  @Query(() => [UserProgress], { name: 'getUserEvaluationResults' })
  @UseGuards(JwtAuthGuard)
  async getUserEvaluationResults(
    @Args('userId') userId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<UserProgress[]> {
    await this.assertMayReadProgress(currentUser, userId);
    return this.usersService.getEvaluationResults(userId);
  }

  @Query(() => Boolean, { name: 'getUserProgress' })
  @UseGuards(JwtAuthGuard)
  async getUserProgress(
    @Args('userId') userId: number,
    @Args('lessonId') lessonId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<boolean> {
    await this.assertMayReadProgress(currentUser, userId);
    return this.usersService.getUserProgress(userId, lessonId);
  }

  // The lessons of a list (a course) the member completed, in one request.
  @Query(() => [Int], { name: 'getCompletedLessons' })
  @UseGuards(JwtAuthGuard)
  async getCompletedLessons(
    @Args('userId', { type: () => Int }) userId: number,
    @Args('lessonIds', { type: () => [Int] }) lessonIds: number[],
    @CurrentUser() currentUser?: User,
  ): Promise<number[]> {
    await this.assertMayReadProgress(currentUser, userId);
    return this.usersService.getCompletedLessonIds(userId, lessonIds);
  }
}
