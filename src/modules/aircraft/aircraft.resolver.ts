import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { AircraftService } from './aircraft.service';
import { Aircraft, AvailabilityStatus } from './entity/aircraft.entity';
import { CreateAircraftInput } from './dto/create-aircraft.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { saveUploadToTmp } from '../../common/uploads/save-upload';
import { UpdateAircraftInput } from './dto/update-aircraft.input';
import { UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';

@Resolver(() => Aircraft)
@UseFilters(LocalizedExceptionFilter)
export class AircraftResolver {
  constructor(private readonly aircraftService: AircraftService) {}

  @Query(() => [Aircraft], { name: 'getAircrafts' })
  @UseGuards(JwtAuthGuard)
  getAircrafts() {
    return this.aircraftService.findAll();
  }

  @Mutation(() => Aircraft)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async createAircraft(
    @Args('createAircraftInput') createAircraftInput: CreateAircraftInput,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file?: FileUpload,
    @Args({ name: 'image', type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
  ): Promise<Aircraft> {
    const filePaths: string[] = [];
    let imagePath: string | null = null;

    if (file) {
      filePaths.push(await saveUploadToTmp(file, 'document'));
    }

    if (image) {
      imagePath = await saveUploadToTmp(image, 'picture');
    }

    return this.aircraftService.create(
      createAircraftInput,
      filePaths,
      imagePath,
    );
  }

  @Mutation(() => Aircraft)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updateAircraft(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @Args('updateAircraftInput') updateAircraftInput: UpdateAircraftInput,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file?: FileUpload,
    @Args({ name: 'image', type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
  ): Promise<Aircraft> {
    const filePaths: string[] = [];
    let imagePath: string | null = null;

    if (file) {
      filePaths.push(await saveUploadToTmp(file, 'document'));
    }

    if (image) {
      imagePath = await saveUploadToTmp(image, 'picture');
    }

    return this.aircraftService.update(
      aircraftId,
      updateAircraftInput,
      filePaths,
      imagePath,
    );
  }

  @Query(() => [Aircraft])
  @UseGuards(JwtAuthGuard)
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

  // Grounds an aircraft or puts it back in service, for instance after an
  // incident: the job of administrators and technicians.
  @Mutation(() => Aircraft)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Technicien')
  setAircraftAvailability(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
    @Args('availability_status', { type: () => AvailabilityStatus })
    availabilityStatus: AvailabilityStatus,
  ): Promise<Aircraft> {
    return this.aircraftService.updateStatus(aircraftId, availabilityStatus);
  }

  @Mutation(() => Boolean, {
    description:
      'true when the aircraft was deleted, false when it has a history and was retired (made unavailable) instead',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async deleteAircraft(
    @Args('aircraftId', { type: () => Int }) aircraftId: number,
  ): Promise<boolean> {
    return this.aircraftService.remove(aircraftId);
  }
}
