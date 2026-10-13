import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { RolesService } from './roles.service';
import { Role } from './entity/roles.entity';
import { CreateRoleInput } from './dto/create-role.input';
import { UpdateRoleInput } from './dto/update-role.input';
import { UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionUser } from '../../common/auth/access';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';

@Resolver(() => Role)
@UseFilters(LocalizedExceptionFilter)
export class RolesResolver {
  constructor(
    private readonly rolesService: RolesService,
    private readonly adminActions: AdminActionsService,
  ) {}

  @Query(() => [Role], { name: 'roles' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.rolesService.findAll();
  }

  @Query(() => Role, { name: 'role' })
  @UseGuards(JwtAuthGuard)
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.rolesService.findOne(id);
  }

  @Mutation(() => Role)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async createRole(
    @Args('createRoleInput') createRoleInput: CreateRoleInput,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const role = await this.rolesService.createRole(createRoleInput);
    await this.adminActions.record(currentUser, ADMIN_ACTION.ROLE_CREATED, {
      type: 'role',
      id: role?.id,
      label: role?.role_name,
    });
    return role;
  }

  @Mutation(() => Role)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updateRole(
    @Args('updateRoleInput') updateRoleInput: UpdateRoleInput,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const previousName = (await this.rolesService.findOne(updateRoleInput.id))
      ?.role_name;
    const role = await this.rolesService.updateRole(updateRoleInput);
    if (role?.role_name !== previousName) {
      await this.adminActions.record(
        currentUser,
        ADMIN_ACTION.ROLE_RENAMED,
        { type: 'role', id: role?.id, label: role?.role_name },
        { from: previousName ?? null, to: role?.role_name ?? null },
      );
    }
    return role;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async deleteRole(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const name = (await this.rolesService.findOne(id))?.role_name;
    const deleted = await this.rolesService.deleteRole(id);
    await this.adminActions.record(currentUser, ADMIN_ACTION.ROLE_DELETED, {
      type: 'role',
      id,
      label: name ?? null,
    });
    return deleted;
  }
}
