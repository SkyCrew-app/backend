import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { RolesService } from './roles.service';
import { Role } from './entity/roles.entity';
import { CreateRoleInput } from './dto/create-role.input';
import { UpdateRoleInput } from './dto/update-role.input';

@Resolver(() => Role)
export class RolesResolver {
  constructor(private readonly rolesService: RolesService) {}

  @Query(() => [Role], { name: 'roles' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Query(() => Role, { name: 'role' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.rolesService.findOne(id);
  }

  @Mutation(() => Role)
  createRole(@Args('createRoleInput') createRoleInput: CreateRoleInput) {
    return this.rolesService.createRole(createRoleInput);
  }

  @Mutation(() => Role)
  updateRole(@Args('updateRoleInput') updateRoleInput: UpdateRoleInput) {
    return this.rolesService.updateRole(updateRoleInput);
  }

  @Mutation(() => Boolean)
  deleteRole(@Args('id', { type: () => Int }) id: number) {
    return this.rolesService.deleteRole(id);
  }
}
