import { Mutation, Resolver, Args } from '@nestjs/graphql';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entity/users.entity';
import { CreateUserInput } from '../users/dto/create-user.input';
import { AdministrationService } from './administration.service';

@Resolver()
export class AdministrationResolver {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersServices: UsersService,
    private readonly administrationService: AdministrationService,
  ) {}

  @Mutation(() => User)
  createUserByAdmin(@Args('createUserInput') createUserInput: CreateUserInput) {
    return this.administrationService.createUserByAdmin(createUserInput);
  }

  @Mutation(() => Boolean)
  async confirmEmailAndSetPassword(
    @Args('token') token: string,
    @Args('password') password: string,
  ): Promise<boolean> {
    try {
      const { email } = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.usersServices.setPassword(email, hashedPassword);
      await this.usersServices.confirmEmail(email);

      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Invalid or expired token');
    }
  }
}
