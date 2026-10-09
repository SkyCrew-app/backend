import { Resolver, Query, Mutation, Args, Context, Int } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './entity/users.entity';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdateUserPreferencesInput } from './dto/update-user-preferences.input';
import { DashboardWidgetConfigInput } from './dto/dashboard-widget-config.type';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import * as path from 'path';
import * as fs from 'fs';
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

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  getUsers() {
    return this.usersService.findAll();
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  createUser(
    @Args('first_name') first_name: string,
    @Args('last_name') last_name: string,
    @Args('email') email: string,
    @Args('date_of_birth') date_of_birth: Date,
  ) {
    return this.usersService.create({
      first_name,
      last_name,
      email,
      date_of_birth,
    });
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

    if (!asAdmin && requestedEmail && requestedEmail !== currentUser.email) {
      throw new ForbiddenException('You can only update your own account');
    }

    const targetEmail = asAdmin
      ? requestedEmail || currentUser.email
      : currentUser.email;

    let imagePath: string | null = null;

    if (image) {
      const { createReadStream, filename } = await image;
      const uploadDir = path.join(__dirname, '../../uploads/tmp');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      imagePath = path.join(uploadDir, filename);
      const stream = createReadStream();
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(imagePath);
        stream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    return this.usersService.updateUser(
      targetEmail,
      updateUserInput,
      imagePath,
      { asAdmin },
    );
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

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
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

  @Mutation(() => User)
  async confirmEmailAndSetPassword(
    @Args('validation_token') token: string,
    @Args('password') password: string,
  ) {
    return this.usersService.confirmEmailAndSetPassword(token, password);
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

    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number,
      profile_picture: user.profile_picture,
    };
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  me(@Context() context): { id: number; email: string } {
    if (!context.req.user) {
      throw new Error('Utilisateur non authentifié');
    }
    return {
      id: context.req.user.id,
      email: context.req.user.email,
    };
  }
}

@Resolver(() => UserProgress)
export class UserProgressResolver {
  constructor(
    private readonly evalService: EvalService,
    private readonly usersService: UsersService,
  ) {}

  @Query(() => [Evaluation], { name: 'getUserProgressByEvaluation' })
  @UseGuards(JwtAuthGuard)
  async getUserProgressByEvaluation(
    @Args('userId') userId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<any[]> {
    assertSelfOrRole(currentUser, userId, ROLE_INSTRUCTOR);
    return this.evalService.getUserEvaluationResults(userId);
  }

  @Query(() => Number, { name: 'getCourseProgress' })
  @UseGuards(JwtAuthGuard)
  async getCourseProgress(
    @Args('userId') userId: number,
    @Args('courseId') courseId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<number> {
    assertSelfOrRole(currentUser, userId, ROLE_INSTRUCTOR);
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
    assertSelfOrRole(currentUser, userId, ROLE_INSTRUCTOR);
    return this.usersService.getEvaluationResults(userId);
  }

  @Query(() => Boolean, { name: 'getUserProgress' })
  @UseGuards(JwtAuthGuard)
  async getUserProgress(
    @Args('userId') userId: number,
    @Args('lessonId') lessonId: number,
    @CurrentUser() currentUser?: User,
  ): Promise<boolean> {
    assertSelfOrRole(currentUser, userId, ROLE_INSTRUCTOR);
    return this.usersService.getUserProgress(userId, lessonId);
  }
}
