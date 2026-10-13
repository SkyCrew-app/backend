import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Like, Repository } from 'typeorm';
import { License } from './entity/licenses.entity';
import { CreateLicenseInput } from './dto/create-license.input';
import { UpdateLicenseInput } from './dto/update-license.input';
import { FileUpload } from 'graphql-upload-ts';
import { UsersService } from '../users/users.service';
import { saveUploadTo } from '../../common/uploads/save-upload';

// Members holding a licence that carries this document (its address under
// /uploads): they are the ones allowed to open it.
export const holdersOfLicenceDocument = async (
  licences: Repository<License>,
  documentUrl: string,
): Promise<number[]> => {
  // The column is a comma-separated list: narrowed in SQL, matched exactly
  // here (in LIKE, "_" stands for any character).
  const candidates = await licences.find({
    where: { documents_url: Like(`%${documentUrl}%`) as never },
    relations: ['user'],
  });
  return candidates
    .filter((licence) => (licence.documents_url ?? []).includes(documentUrl))
    .map((licence) => licence.user?.id)
    .filter((id): id is number => id != null);
};

@Injectable()
export class LicensesService {
  constructor(
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    private readonly usersService: UsersService,
  ) {}

  async findAll(): Promise<License[]> {
    return this.licenseRepository.find({ relations: ['user'] });
  }

  async findOne(id: number): Promise<License> {
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!license) {
      throw new NotFoundException(`License with ID ${id} not found.`);
    }
    return license;
  }

  async create(createLicenseInput: CreateLicenseInput): Promise<License> {
    const { user_id, ...licenseData } = createLicenseInput;

    const user = await this.usersService.findOneById(user_id);
    if (!user) {
      throw new NotFoundException(`User with ID ${user_id} not found.`);
    }

    const license = this.licenseRepository.create({
      ...licenseData,
      user,
    });

    return this.licenseRepository.save(license);
  }

  async update(updateLicenseInput: UpdateLicenseInput): Promise<License> {
    const license = await this.findOne(updateLicenseInput.id);
    // A field that is not sent keeps its value; the documents are only
    // replaced by an actual list.
    for (const [field, value] of Object.entries(updateLicenseInput)) {
      const notSent =
        value === undefined || (field === 'documents_url' && value === null);
      if (field !== 'id' && !notSent) {
        license[field] = value;
      }
    }
    return this.licenseRepository.save(license);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.licenseRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`License with ID ${id} not found.`);
    }
    return true;
  }

  async uploadFiles(files?: FileUpload[]): Promise<string[] | null> {
    if (!files || files.length === 0) return null;

    const resolvedFiles = await Promise.all(files);
    const paths: string[] = [];

    for (const file of resolvedFiles) {
      const path = await this.uploadFile(file);
      if (path) paths.push(path);
    }

    return paths;
  }

  async uploadFile(file: FileUpload): Promise<string | null> {
    if (!file) return null;
    return saveUploadTo(file, 'document', 'licences');
  }

  async findExpiringLicenses(thresholdDays: number = 7): Promise<License[]> {
    const now = new Date();
    const thresholdDate = new Date(
      now.getTime() + thresholdDays * 24 * 60 * 60 * 1000,
    );
    return this.licenseRepository.find({
      where: {
        expiration_date: LessThanOrEqual(thresholdDate),
        status: 'active',
      },
      relations: ['user'],
    });
  }
}
