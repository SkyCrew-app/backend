import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { MaintenanceService } from './maintenance.service';
import { Maintenance } from './entity/maintenance.entity';
import { CreateMaintenanceInput } from './dto/create-maintenance.input';
import { UpdateMaintenanceInput } from './dto/update-maintenance.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
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
    const filePaths = [];
    const imagePaths = [];

    if (files) {
      for (const file of files) {
        const { createReadStream, filename } = await file;
        const uploadDir = path.join(__dirname, '../../uploads/tmp');
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, filename);
        const stream = createReadStream();
        await new Promise<void>((resolve, reject) => {
          const writeStream = createWriteStream(filePath);
          stream.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        filePaths.push(filePath);
      }
    }

    if (images) {
      for (const image of images) {
        const { createReadStream, filename } = await image;
        const uploadDir = path.join(__dirname, '../../uploads/tmp');
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        const imagePath = path.join(uploadDir, filename);
        const stream = createReadStream();
        await new Promise<void>((resolve, reject) => {
          const writeStream = createWriteStream(imagePath);
          stream.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        imagePaths.push(imagePath);
      }
    }

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
    const filePaths = [];
    const imagePaths = [];

    if (files) {
      for (const file of files) {
        const { createReadStream, filename } = await file;
        const uploadDir = path.join(__dirname, '../../uploads/tmp');
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, filename);
        const stream = createReadStream();
        await new Promise<void>((resolve, reject) => {
          const writeStream = createWriteStream(filePath);
          stream.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        filePaths.push(filePath);
      }
    }

    if (images) {
      for (const image of images) {
        const { createReadStream, filename } = await image;
        const uploadDir = path.join(__dirname, '../../uploads/tmp');
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        const imagePath = path.join(uploadDir, filename);
        const stream = createReadStream();
        await new Promise<void>((resolve, reject) => {
          const writeStream = createWriteStream(imagePath);
          stream.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        imagePaths.push(imagePath);
      }
    }

    return this.maintenanceService.update(
      updateMaintenanceInput,
      filePaths,
      imagePaths,
    );
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
