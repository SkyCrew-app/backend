import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { AdministrationService } from './administration.service';
import { Administration } from './entity/admin.entity';
import { CreateAdministrationInput } from './dto/create-admin.input';
import { UpdateAdministrationInput } from './dto/update-admin.input';

@Resolver(() => Administration)
export class AdministrationResolver {
  constructor(private readonly administrationService: AdministrationService) {}

  @Query(() => [Administration], { name: 'getAllAdministrations' })
  findAll() {
    return this.administrationService.findAll();
  }

  @Mutation(() => Administration, { name: 'createAdministration' })
  create(
    @Args('createAdministrationInput')
    createAdministrationInput: CreateAdministrationInput,
  ): Promise<Administration> {
    return this.administrationService.create(createAdministrationInput);
  }

  @Mutation(() => Administration, { name: 'updateAdministration' })
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
}
