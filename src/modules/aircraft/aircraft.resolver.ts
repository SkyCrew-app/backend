import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { AircraftService } from './aircraft.service';
import { Aircraft } from './entity/aircraft.entity';
import { CreateAircraftInput } from './dto/create-aircraft.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import * as path from 'path';

@Resolver(() => Aircraft)
export class AircraftResolver {
  constructor(private readonly aircraftService: AircraftService) {}

  @Query(() => [Aircraft], { name: 'getAircrafts' })
  getAircrafts() {
    return this.aircraftService.findAll();
  }

  @Mutation(() => Aircraft)
  async createAircraft(
    @Args('createAircraftInput') createAircraftInput: CreateAircraftInput,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file?: FileUpload,
    @Args({ name: 'image', type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
  ): Promise<Aircraft> {
    const filePaths = [];
    let imagePath = null;

    if (file) {
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

    // Gérer l'image
    if (image) {
      const { createReadStream, filename } = await image;
      const uploadDir = path.join(__dirname, '../../uploads/tmp');
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

      imagePath = path.join(uploadDir, filename);
      const stream = createReadStream();
      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(imagePath);
        stream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    return this.aircraftService.create(
      createAircraftInput,
      filePaths,
      imagePath,
    );
  }

  @Mutation(() => Aircraft)
  async updateAircraft(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @Args('updateAircraftInput') updateAircraftInput: CreateAircraftInput,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file?: FileUpload,
    @Args({ name: 'image', type: () => GraphQLUpload, nullable: true })
    image?: FileUpload, // Ajout de l'image
  ): Promise<Aircraft> {
    const filePaths = [];
    let imagePath = null;

    // Gérer les fichiers de documents
    if (file) {
      const { createReadStream, filename } = await file;
      const uploadDir = path.join(__dirname, '../../uploads/tmp'); // Temporaire
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

    // Gérer l'image
    if (image) {
      const { createReadStream, filename } = await image;
      const uploadDir = path.join(__dirname, '../../uploads/tmp'); // Temporaire
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

      imagePath = path.join(uploadDir, filename);
      const stream = createReadStream();
      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(imagePath);
        stream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    return this.aircraftService.update(
      aircraftId,
      updateAircraftInput,
      filePaths,
      imagePath,
    );
  }

  @Query(() => [Aircraft])
  async getHistoryAircraft(): Promise<Aircraft[]> {
    return this.aircraftService.aircraftHistory({
      relations: [
        'reservations',
        'maintenances',
        'reservations.user',
        'maintenances.technician',
      ],
    });
  }
}
