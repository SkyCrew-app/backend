import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Aircraft } from './entity/aircraft.entity';
import { CreateAircraftInput } from './dto/create-aircraft.input';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class AircraftService {
  constructor(
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
  ) {}

  findAll(): Promise<Aircraft[]> {
    return this.aircraftRepository.find({
      relations: ['reservations', 'maintenances'],
    });
  }

  findOne(aircraftId: number): Promise<Aircraft> {
    return this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
      relations: ['reservations', 'maintenances'],
    });
  }

  async create(
    createAircraftInput: CreateAircraftInput,
    filePaths: string[],
    imagePath: string | null,
  ): Promise<Aircraft> {
    const newAircraft = this.aircraftRepository.create(createAircraftInput);

    await this.aircraftRepository.save(newAircraft);

    const aircraftDir = path.join(
      __dirname,
      '../../uploads',
      String(newAircraft.id),
    );

    if (!fs.existsSync(aircraftDir)) {
      fs.mkdirSync(aircraftDir, { recursive: true });
    }

    if (filePaths && filePaths.length > 0) {
      newAircraft.documents_url = filePaths.map((filePath) => {
        const destinationPath = path.join(aircraftDir, path.basename(filePath));
        fs.renameSync(filePath, destinationPath);
        return `/uploads/${newAircraft.id}/${path.basename(filePath)}`;
      });
    }

    if (imagePath) {
      const destinationImagePath = path.join(
        aircraftDir,
        path.basename(imagePath),
      );
      fs.renameSync(imagePath, destinationImagePath);
      newAircraft.image_url = `/uploads/${newAircraft.id}/${path.basename(imagePath)}`;
    }

    return this.aircraftRepository.save(newAircraft);
  }

  async update(
    aircraftId: number,
    updateAircraftInput: CreateAircraftInput,
    filePaths: string[],
    imagePath: string | null,
  ): Promise<Aircraft> {
    const aircraft = await this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
    });

    const aircraftDir = path.join(
      __dirname,
      '../../uploads',
      String(aircraftId),
    );

    if (!fs.existsSync(aircraftDir)) {
      fs.mkdirSync(aircraftDir, { recursive: true });
    }

    if (filePaths && filePaths.length > 0) {
      aircraft.documents_url = filePaths.map((filePath) => {
        const destinationPath = path.join(aircraftDir, path.basename(filePath));
        fs.renameSync(filePath, destinationPath);
        return `/uploads/${aircraftId}/${path.basename(filePath)}`;
      });
    }

    if (imagePath) {
      const destinationImagePath = path.join(
        aircraftDir,
        path.basename(imagePath),
      );
      fs.renameSync(imagePath, destinationImagePath);
      aircraft.image_url = `/uploads/${aircraftId}/${path.basename(imagePath)}`;
    }

    Object.assign(aircraft, updateAircraftInput);

    return this.aircraftRepository.save(aircraft);
  }

  async updateStatus(
    aircraftId: number,
    availabilityStatus: string,
  ): Promise<Aircraft> {
    const aircraft = await this.aircraftRepository.findOneOrFail({
      where: { id: aircraftId },
    });
    aircraft.availability_status = availabilityStatus;
    return this.aircraftRepository.save(aircraft);
  }

  aircraftHistory(options?: any): Promise<Aircraft[]> {
    return this.aircraftRepository.find(options);
  }
}
