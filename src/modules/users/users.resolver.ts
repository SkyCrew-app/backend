import { Resolver, Query, Mutation, Args, Context, Int } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './entity/users.entity';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdateUserPreferencesInput } from './dto/update-user-preferences.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import * as path from 'path';
import * as fs from 'fs';
import { EvalService } from '../eval/eval.service';
import { Evaluation } from '../eval/entity/evaluation.entity';
import { UserProgress } from './entity/user-progress.entity';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User])
  @UseGuards(JwtAuthGuard)
  getUsers() {
    return this.usersService.findAll();
  }

  @Mutation(() => User)
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
  userByEmail(@Args('email') email: string) {
    return this.usersService.findOneByEmail(email);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @Args({ name: 'image', type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
  ): Promise<User> {
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

    return this.usersService.updateUser(updateUserInput, imagePath);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  toggle2FA(
    @Args('email') email: string,
    @Args('is2FAEnabled') is2FAEnabled: boolean,
  ) {
    return this.usersService.update2FAStatus(email, is2FAEnabled);
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
  async getUserDetails(@Args('id', { type: () => Int }) id: number) {
    return this.usersService.findOneById(id);
  }

  @Mutation(() => User)
  async confirmEmailAndSetPassword(
    @Args('token') token: string,
    @Args('password') password: string,
  ) {
    return this.usersService.confirmEmailAndSetPassword(token, password);
  }

  @Query(() => User)
  async getUserPreferences(@Args('userId') userId: number): Promise<User> {
    return this.usersService.getUserPreferences(userId);
  }
  @Mutation(() => User)
  async updateUserPreferences(
    @Args('userId', { type: () => Number }) userId: number,
    @Args('preference', { type: () => UpdateUserPreferencesInput })
    preference: UpdateUserPreferencesInput,
  ): Promise<User> {
    return this.usersService.updateUserPreferences(
      userId,
      preference.language,
      preference.speed_unit,
      preference.distance_unit,
      preference.timezone,
      preference.preferred_aerodrome,
    );
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
  async getUserProgressByEvaluation(
    @Args('userId') userId: number,
  ): Promise<any[]> {
    return this.evalService.getUserEvaluationResults(userId);
  }

  @Query(() => Number, { name: 'getCourseProgress' })
  async getCourseProgress(
    @Args('userId') userId: number,
    @Args('courseId') courseId: number,
  ): Promise<number> {
    return this.usersService.getCourseProgress(userId, courseId);
  }

  @Mutation(() => Boolean, { name: 'markLessonStarted' })
  async markLessonStarted(
    @Args('userId') userId: number,
    @Args('lessonId') lessonId: number,
  ): Promise<boolean> {
    await this.usersService.markLessonStarted(userId, lessonId);
    return true;
  }

  @Mutation(() => Boolean, { name: 'markLessonCompleted' })
  async markLessonCompleted(
    @Args('userId') userId: number,
    @Args('lessonId') lessonId: number,
  ): Promise<boolean> {
    await this.usersService.markLessonCompleted(userId, lessonId);
    return true;
  }

  @Query(() => [UserProgress], { name: 'getUserEvaluationResults' })
  async getUserEvaluationResults(
    @Args('userId') userId: number,
  ): Promise<UserProgress[]> {
    return this.usersService.getEvaluationResults(userId);
  }

  @Query(() => Boolean, { name: 'getUserProgress' })
  async getUserProgress(
    @Args('userId') userId: number,
    @Args('lessonId') lessonId: number,
  ): Promise<boolean> {
    return this.usersService.getUserProgress(userId, lessonId);
  }
}
