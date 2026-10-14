import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { LicensesService } from './licenses.service';
import { License } from './entity/licenses.entity';
import { CreateLicenseInput } from './dto/create-license.input';
import { UpdateLicenseInput } from './dto/update-license.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { UseFilters, UseGuards } from '@nestjs/common';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  assertSelfOrRole,
  ROLE_ADMIN,
  ROLE_INSTRUCTOR,
  SessionUser,
} from '../../common/auth/access';
import {
  AddMyLicenseInput,
  UpdateMyLicenseInput,
} from './dto/my-license.input';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';

@Resolver(() => License)
@UseFilters(LocalizedExceptionFilter)
export class LicensesResolver {
  constructor(
    private readonly licensesService: LicensesService,
    private readonly adminActions: AdminActionsService,
  ) {}

  // The licences of the member signed in, whatever their status.
  @Query(() => [License], { name: 'myLicenses' })
  @UseGuards(JwtAuthGuard)
  myLicenses(@CurrentUser() currentUser: SessionUser) {
    return this.licensesService.findOfMember(currentUser.id);
  }

  // A member adds a licence of their own; it is pending until an
  // administrator validates it.
  @Mutation(() => License)
  @UseGuards(JwtAuthGuard)
  async addMyLicense(
    @Args('input') input: AddMyLicenseInput,
    @Args({ name: 'documents', type: () => [GraphQLUpload], nullable: true })
    documents: FileUpload[] | undefined,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<License> {
    const documentsPath = await this.licensesService.uploadFiles(documents);
    return this.licensesService.addForMember(
      currentUser.id,
      input,
      documentsPath,
    );
  }

  // A member changes one of their own licences; it goes back to pending.
  @Mutation(() => License)
  @UseGuards(JwtAuthGuard)
  async updateMyLicense(
    @Args('input') input: UpdateMyLicenseInput,
    @Args({ name: 'documents', type: () => [GraphQLUpload], nullable: true })
    documents: FileUpload[] | undefined,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<License> {
    const documentsPath = await this.licensesService.uploadFiles(documents);
    return this.licensesService.updateForMember(
      currentUser.id,
      input,
      documentsPath,
    );
  }

  // An administrator validates a licence: it becomes active (or stays
  // expired when its date has passed). Traced.
  @Mutation(() => License)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_ADMIN)
  async validateLicense(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<License> {
    const { licence, previousStatus } = await this.licensesService.validate(id);
    await this.traceValidation(currentUser, licence, previousStatus);
    return licence;
  }

  @Query(() => [License], { name: 'getAllLicenses' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.licensesService.findAll();
  }

  @Query(() => License, { name: 'getLicenseById', nullable: true })
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    // A licence is read by its holder, instructors and administrators.
    const license = await this.licensesService.findOne(id);
    assertSelfOrRole(currentUser, license.user?.id, ROLE_INSTRUCTOR);
    return license;
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
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const documentsPath = await this.licensesService.uploadFiles(documents);
    const previousStatus = (
      await this.licensesService.findOne(updateLicenseInput.id)
    )?.status;

    // Without a new upload the documents already on the licence stay: the
    // list only changes when files are sent, or when it is given explicitly.
    const licence = await this.licensesService.update(
      documentsPath
        ? { ...updateLicenseInput, documents_url: documentsPath }
        : updateLicenseInput,
    );
    // A pending licence made active here is a validation too.
    if (previousStatus === 'pending' && licence?.status === 'active') {
      await this.traceValidation(currentUser, licence, previousStatus);
    }
    return licence;
  }

  private traceValidation(
    currentUser: SessionUser | undefined,
    licence: License,
    previousStatus: string,
  ) {
    return this.adminActions.record(
      currentUser,
      ADMIN_ACTION.LICENCE_VALIDATED,
      {
        type: 'licence',
        id: licence.id,
        label: `${licence.license_type} ${licence.license_number ?? ''}`.trim(),
      },
      {
        memberId: licence.user?.id != null ? String(licence.user.id) : null,
        from: previousStatus,
        to: licence.status,
      },
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  deleteLicense(@Args('id', { type: () => Int }) id: number) {
    return this.licensesService.remove(id);
  }
}
