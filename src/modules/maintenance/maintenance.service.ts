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

  // Créer une maintenance
  async create(
    createMaintenanceInput: CreateMaintenanceInput,
    filePaths: string[], // Documents
    imagePaths: string[], // Images
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

    // Sauvegarder la maintenance pour obtenir l'ID
    await this.maintenanceRepository.save(newMaintenance);

    const maintenanceDir = path.join(
      __dirname,
      '../../uploads/maintenance',
      String(newMaintenance.id),
    );

    // Créer le dossier de la maintenance
    if (!fs.existsSync(maintenanceDir)) {
      fs.mkdirSync(maintenanceDir, { recursive: true });
    }

    // Déplacer et enregistrer les documents
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

    // Déplacer et enregistrer les images
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

  // Mettre à jour une maintenance avec upload de fichiers
  async update(
    updateMaintenanceInput: UpdateMaintenanceInput,
    filePaths: string[], // Documents
    imagePaths: string[], // Images
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

    // Créer le dossier de la maintenance s'il n'existe pas
    if (!fs.existsSync(maintenanceDir)) {
      fs.mkdirSync(maintenanceDir, { recursive: true });
    }

    // Déplacer et enregistrer les documents
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

    // Déplacer et enregistrer les images
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

    // Mise à jour des autres champs
    Object.assign(maintenance, updateMaintenanceInput);

    return this.maintenanceRepository.save(maintenance);
  }

  // Récupérer une maintenance par ID
  async findOne(id: number): Promise<Maintenance> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
    });
    if (!maintenance) {
      throw new NotFoundException('Maintenance not found');
    }
    return maintenance;
  }

  // Récupérer toutes les maintenances d'un avion
  async findAllByAircraft(aircraftId: number): Promise<Maintenance[]> {
    return this.maintenanceRepository.find({
      where: { aircraft: { id: aircraftId } },
      relations: ['aircraft', 'technician'], // Inclure les relations
    });
  }

  async findAll(): Promise<Maintenance[]> {
    return this.maintenanceRepository.find({
      relations: ['aircraft', 'technician'], // Inclure les relations
    });
  }
}
