import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Administration } from './entity/admin.entity';
import { CreateAdministrationInput } from './dto/create-admin.input';
import { UpdateAdministrationInput } from './dto/update-admin.input';

@Injectable()
export class AdministrationService {
  constructor(
    @InjectRepository(Administration)
    private readonly administrationRepository: Repository<Administration>,
  ) {}

  async create(
    createAdministrationInput: CreateAdministrationInput,
  ): Promise<Administration> {
    const administration = this.administrationRepository.create(
      createAdministrationInput,
    );
    return this.administrationRepository.save(administration);
  }

  async findAll(): Promise<Administration[]> {
    return this.administrationRepository.find();
  }

  async findOne(id: number): Promise<Administration> {
    const administration = await this.administrationRepository.findOne({
      where: { id },
    });
    if (!administration) {
      throw new NotFoundException(`Administration with ID ${id} not found`);
    }
    return administration;
  }

  async update(
    id: number,
    updateAdministrationInput: UpdateAdministrationInput,
  ): Promise<Administration> {
    const administration = await this.findOne(id);
    Object.assign(administration, updateAdministrationInput);
    return this.administrationRepository.save(administration);
  }

  async remove(id: number): Promise<boolean> {
    const administration = await this.findOne(id);
    await this.administrationRepository.remove(administration);
    return true;
  }

  async getMaintenance(): Promise<boolean> {
    const isMaintenanceActive = this.administrationRepository.findOne({
      where: { id: 1 },
    });

    return (await isMaintenanceActive).isMaintenanceActive;
  }
}
