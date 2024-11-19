import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Maintenance } from './entity/maintenance.entity';
import { CreateMaintenanceInput } from './dto/create-maintenance.input';
import { UpdateMaintenanceInput } from './dto/update-maintenance.input';
import { AircraftService } from '../aircraft/aircraft.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(Maintenance)
    private readonly maintenanceRepository: Repository<Maintenance>,
    private readonly aircraftService: AircraftService,
  ) {}

  async create(
    createMaintenanceInput: CreateMaintenanceInput,
    filePaths: string[],
    imagePaths: string[],
  ): Promise<Maintenance> {
    const aircraft = await this.aircraftService.findOne(
      createMaintenanceInput.aircraft_id,
    );
    if (!aircraft) {
      throw new NotFoundException('Aircraft not found');
    }

    const newMaintenance = this.maintenanceRepository.create({
      ...createMaintenanceInput,
      aircraft,
    });

    await this.maintenanceRepository.save(newMaintenance);

    const maintenanceDir = path.join(
      __dirname,
      '../../uploads/maintenance',
      String(newMaintenance.id),
    );

    if (!fs.existsSync(maintenanceDir)) {
      fs.mkdirSync(maintenanceDir, { recursive: true });
    }

    if (filePaths && filePaths.length > 0) {
      newMaintenance.documents_url = filePaths.map((filePath) => {
        const destinationPath = path.join(
          maintenanceDir,
          path.basename(filePath),
        );
        fs.renameSync(filePath, destinationPath);
        return `/uploads/maintenance/${newMaintenance.id}/${path.basename(filePath)}`;
      });
    }

    if (imagePaths && imagePaths.length > 0) {
      newMaintenance.images_url = imagePaths.map((imagePath) => {
        const destinationPath = path.join(
          maintenanceDir,
          path.basename(imagePath),
        );
        fs.renameSync(imagePath, destinationPath);
        return `/uploads/maintenance/${newMaintenance.id}/${path.basename(imagePath)}`;
      });
    }

    return this.maintenanceRepository.save(newMaintenance);
  }

  async update(
    updateMaintenanceInput: UpdateMaintenanceInput,
    filePaths: string[],
    imagePaths: string[],
  ): Promise<Maintenance> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id: updateMaintenanceInput.id },
    });

    if (!maintenance) {
      throw new NotFoundException('Maintenance not found');
    }

    const maintenanceDir = path.join(
      __dirname,
      '../../uploads/maintenance',
      String(maintenance.id),
    );

    if (!fs.existsSync(maintenanceDir)) {
      fs.mkdirSync(maintenanceDir, { recursive: true });
    }

    if (filePaths && filePaths.length > 0) {
      maintenance.documents_url = filePaths.map((filePath) => {
        const destinationPath = path.join(
          maintenanceDir,
          path.basename(filePath),
        );
        fs.renameSync(filePath, destinationPath);
        return `/uploads/maintenance/${maintenance.id}/${path.basename(filePath)}`;
      });
    }

    if (imagePaths && imagePaths.length > 0) {
      maintenance.images_url = imagePaths.map((imagePath) => {
        const destinationPath = path.join(
          maintenanceDir,
          path.basename(imagePath),
        );
        fs.renameSync(imagePath, destinationPath);
        return `/uploads/maintenance/${maintenance.id}/${path.basename(imagePath)}`;
      });
    }

    Object.assign(maintenance, updateMaintenanceInput);

    return this.maintenanceRepository.save(maintenance);
  }

  async findOne(id: number): Promise<Maintenance> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
    });
    if (!maintenance) {
      throw new NotFoundException('Maintenance not found');
    }
    return maintenance;
  }

  async findAllByAircraft(aircraftId: number): Promise<Maintenance[]> {
    return this.maintenanceRepository.find({
      where: { aircraft: { id: aircraftId } },
      relations: ['aircraft', 'technician'],
    });
  }

  async findAll(): Promise<Maintenance[]> {
    return this.maintenanceRepository.find({
      relations: ['aircraft', 'technician'],
    });
  }
}
