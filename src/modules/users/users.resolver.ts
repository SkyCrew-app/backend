import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './entity/users.entity';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { UpdateUserInput } from './dto/update-user.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import * as path from 'path';
import * as fs from 'fs';
import { existsSync, mkdirSync } from 'fs';

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
    @Args('password') password: string,
    @Args('date_of_birth') date_of_birth: Date,
  ) {
    return this.usersService.create({
      first_name,
      last_name,
      email,
      password,
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
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

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
}
