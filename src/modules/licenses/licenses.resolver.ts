import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { LicensesService } from './licenses.service';
import { License } from './entity/licenses.entity';
import { CreateLicenseInput } from './dto/create-license.input';
import { UpdateLicenseInput } from './dto/update-license.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver(() => License)
export class LicensesResolver {
  constructor(private readonly licensesService: LicensesService) {}

  @Query(() => [License], { name: 'getAllLicenses' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.licensesService.findAll();
  }

  @Query(() => License, { name: 'getLicenseById', nullable: true })
  @UseGuards(JwtAuthGuard)
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.licensesService.findOne(id);
  }

  @Mutation(() => License)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async createLicense(
    @Args('createLicenseInput') createLicenseInput: CreateLicenseInput,
    @Args({ name: 'documents', type: () => [GraphQLUpload], nullable: true })
    documents?: FileUpload[],
  ): Promise<License> {
    const documentsPath = await this.licensesService.uploadFiles(documents);

    return this.licensesService.create({
      ...createLicenseInput,
      documents_url: documentsPath,
    });
  }

  @Mutation(() => License)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updateLicense(
    @Args('updateLicenseInput') updateLicenseInput: UpdateLicenseInput,
    @Args({ name: 'documents', type: () => [GraphQLUpload], nullable: true })
    documents?: FileUpload[],
  ) {
    const documentsPath = await this.licensesService.uploadFiles(documents);

    return this.licensesService.update({
      ...updateLicenseInput,
      documents_url: documentsPath,
    });
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  deleteLicense(@Args('id', { type: () => Int }) id: number) {
    return this.licensesService.remove(id);
  }
}
