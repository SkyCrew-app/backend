import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { AdministrationService } from './administration.service';
import { Administration } from './entity/admin.entity';
import { CreateAdministrationInput } from './dto/create-admin.input';
import { UpdateAdministrationInput } from './dto/update-admin.input';
import { AdminDashboardStats } from 'src/types/administration.types';
import { adminStatus } from './dto/adminStatus.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver(() => Administration)
export class AdministrationResolver {
  constructor(private readonly administrationService: AdministrationService) {}

  @Query(() => [Administration], { name: 'getAllAdministrations' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.administrationService.findAll();
  }

  @Mutation(() => Administration, { name: 'createAdministration' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  create(
    @Args('createAdministrationInput')
    createAdministrationInput: CreateAdministrationInput,
  ): Promise<Administration> {
    return this.administrationService.create(createAdministrationInput);
  }

  @Mutation(() => Administration, { name: 'updateAdministration' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  update(
    @Args('updateAdministrationInput')
    updateAdministrationInput: UpdateAdministrationInput,
  ) {
    return this.administrationService.update(
      updateAdministrationInput.id,
      updateAdministrationInput,
    );
  }

  @Mutation(() => Boolean, { name: 'deleteAdministration' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  delete(@Args('id', { type: () => Int }) id: number) {
    return this.administrationService.remove(id);
  }

  @Query(() => Boolean, { name: 'getSiteStatus' })
  getSiteStatus() {
    return this.administrationService.getMaintenance();
  }

  @Query(() => String, { name: 'getMaintenanceDetails' })
  async getMaintenanceDetails() {
    const details = await this.administrationService.getMaintenanceDetails();
    return JSON.stringify(details);
  }

  @Mutation(() => Boolean, { name: 'setSiteStatus' })
  setSiteStatus() {
    return this.administrationService.setMaintenance();
  }

  @Query(() => adminStatus, { name: 'adminDashboardStats' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async adminDashboardStats(): Promise<AdminDashboardStats> {
    return this.administrationService.getAdminDashboardStats();
  }
}
