import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt.guard';
import { Resolver, Query } from '@nestjs/graphql';
import { User } from '../../modules/users/entity/users.entity';
import { UsersService } from '../../modules/users/users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User])
  @UseGuards(JwtAuthGuard)
  getUsers() {
    return this.usersService.findAll();
  }
}
