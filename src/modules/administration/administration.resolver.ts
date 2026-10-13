import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { AdministrationService } from './administration.service';
import { Administration } from './entity/admin.entity';
import { CreateAdministrationInput } from './dto/create-admin.input';
import { UpdateAdministrationInput } from './dto/update-admin.input';
import { AdminDashboardStats } from 'src/types/administration.types';
import { adminStatus } from './dto/adminStatus.input';
import { UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionUser } from '../../common/auth/access';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import {
  ADMIN_ACTION,
  changedFields,
} from '../../common/admin-actions/admin-actions';

@Resolver(() => Administration)
@UseFilters(LocalizedExceptionFilter)
export class AdministrationResolver {
  constructor(
    private readonly administrationService: AdministrationService,
    private readonly adminActions: AdminActionsService,
  ) {}

  // Opening hours, closure days, rates and rules: every member needs them,
  // starting with the reservation schedule. Changing them stays
  // administrator-only.
  @Query(() => [Administration], { name: 'getAllAdministrations' })
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.administrationService.findAll();
  }

  @Mutation(() => Administration, { name: 'createAdministration' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async create(
    @Args('createAdministrationInput')
    createAdministrationInput: CreateAdministrationInput,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Administration> {
    const created = await this.administrationService.create(
      createAdministrationInput,
    );
    await this.adminActions.record(
      currentUser,
      ADMIN_ACTION.SETTINGS_CHANGED,
      { type: 'settings', id: created?.id },
      { created: true },
    );
    return created;
  }

  @Mutation(() => Administration, { name: 'updateAdministration' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async update(
    @Args('updateAdministrationInput')
    updateAdministrationInput: UpdateAdministrationInput,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    // A copy of the settings as they were, to trace what changed.
    const before = {
      ...(await this.administrationService.findOne(
        updateAdministrationInput.id,
      )),
    } as Record<string, unknown>;
    const updated = await this.administrationService.update(
      updateAdministrationInput.id,
      updateAdministrationInput,
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...sent } = updateAdministrationInput as unknown as Record<
      string,
      unknown
    >;
    const changes = changedFields(before, sent);
    if (Object.keys(changes).length > 0) {
      await this.adminActions.record(
        currentUser,
        ADMIN_ACTION.SETTINGS_CHANGED,
        { type: 'settings', id: updateAdministrationInput.id },
        { changes },
      );
    }
    return updated;
  }

  @Mutation(() => Boolean, { name: 'deleteAdministration' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  delete(@Args('id', { type: () => Int }) id: number) {
    return this.administrationService.remove(id);
  }

  // Read by the frontend before any login, to show the maintenance page.
  @Public()
  @Query(() => Boolean, { name: 'getSiteStatus' })
  getSiteStatus() {
    return this.administrationService.getMaintenance();
  }

  @Public()
  @Query(() => String, { name: 'getMaintenanceDetails' })
  async getMaintenanceDetails() {
    const details = await this.administrationService.getMaintenanceDetails();
    return JSON.stringify(details);
  }

  @Mutation(() => Boolean, { name: 'setSiteStatus' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async setSiteStatus(@CurrentUser() currentUser?: SessionUser) {
    const active = await this.administrationService.setMaintenance();
    await this.adminActions.record(
      currentUser,
      ADMIN_ACTION.SITE_MAINTENANCE_TOGGLED,
      { type: 'settings', id: 1 },
      { maintenanceActive: active },
    );
    return active;
  }

  @Query(() => adminStatus, { name: 'adminDashboardStats' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async adminDashboardStats(): Promise<AdminDashboardStats> {
    return this.administrationService.getAdminDashboardStats();
  }
}
