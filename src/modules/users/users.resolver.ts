import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './entity/users.entity';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';

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
}
