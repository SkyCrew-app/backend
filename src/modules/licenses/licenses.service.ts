import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { License } from './entity/licenses.entity';
import { CreateLicenseInput } from './dto/create-license.input';
import { UpdateLicenseInput } from './dto/update-license.input';
import { FileUpload } from 'graphql-upload-ts';
import { UsersService } from '../users/users.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
    Object.assign(license, updateLicenseInput);
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

    const { createReadStream, filename } = file;

    const uploadDir = path.join(__dirname, '../../uploads/licences');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const uniqueFilename = `${uniqueSuffix}-${filename}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    const stream = createReadStream();

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return `/uploads/licences/${uniqueFilename}`;
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
