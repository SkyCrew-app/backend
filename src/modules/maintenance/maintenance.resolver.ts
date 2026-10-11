import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { MaintenanceService } from './maintenance.service';
import { Maintenance } from './entity/maintenance.entity';
import { CreateMaintenanceInput } from './dto/create-maintenance.input';
import { UpdateMaintenanceInput } from './dto/update-maintenance.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { saveUploadToTmp } from '../../common/uploads/save-upload';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver(() => Maintenance)
export class MaintenanceResolver {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Mutation(() => Maintenance)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Technicien', 'Administrateur')
  async createMaintenance(
    @Args('createMaintenanceInput')
    createMaintenanceInput: CreateMaintenanceInput,
    @Args({ name: 'files', type: () => [GraphQLUpload], nullable: true })
    files?: FileUpload[],
    @Args({ name: 'images', type: () => [GraphQLUpload], nullable: true })
    images?: FileUpload[],
  ): Promise<Maintenance> {
    const filePaths = await this.saveUploads(files);
    const imagePaths = await this.saveUploads(images);

    return this.maintenanceService.create(
      createMaintenanceInput,
      filePaths,
      imagePaths,
    );
  }

  @Mutation(() => Maintenance)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Technicien', 'Administrateur')
  async updateMaintenance(
    @Args('updateMaintenanceInput')
    updateMaintenanceInput: UpdateMaintenanceInput,
    @Args({ name: 'files', type: () => [GraphQLUpload], nullable: true })
    files?: FileUpload[],
    @Args({ name: 'images', type: () => [GraphQLUpload], nullable: true })
    images?: FileUpload[],
  ): Promise<Maintenance> {
    const filePaths = await this.saveUploads(files);
    const imagePaths = await this.saveUploads(images);

    return this.maintenanceService.update(
      updateMaintenanceInput,
      filePaths,
      imagePaths,
    );
  }

  // Removes one image or document; the others are kept.
  @Mutation(() => Maintenance)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Technicien', 'Administrateur')
  async removeMaintenanceAttachment(
    @Args('maintenanceId', { type: () => Int }) maintenanceId: number,
    @Args('url') url: string,
  ): Promise<Maintenance> {
    return this.maintenanceService.removeAttachment(maintenanceId, url);
  }

  private async saveUploads(uploads?: FileUpload[]): Promise<string[]> {
    const paths: string[] = [];
    for (const upload of uploads ?? []) {
      paths.push(await saveUploadToTmp(upload));
    }
    return paths;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Technicien', 'Administrateur')
  async deleteMaintenance(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.maintenanceService.remove(id);
  }

  @Query(() => Maintenance, { name: 'getMaintenance' })
  @UseGuards(JwtAuthGuard)
  async getMaintenance(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<Maintenance> {
    return this.maintenanceService.findOne(id);
  }

  @Query(() => [Maintenance], { name: 'getMaintenancesByAircraft' })
  @UseGuards(JwtAuthGuard)
  async getMaintenancesByAircraft(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
  ): Promise<Maintenance[]> {
    return this.maintenanceService.findAllByAircraft(aircraftId);
  }

  @Query(() => [Maintenance], { name: 'getAllMaintenances' })
  @UseGuards(JwtAuthGuard)
  async getAllMaintenances(): Promise<Maintenance[]> {
    return this.maintenanceService.findAll();
  }
}
