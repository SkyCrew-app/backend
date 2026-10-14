import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Like, Not, Repository } from 'typeorm';
import { License, LICENCE_NUMBER_UNIQUE_INDEX } from './entity/licenses.entity';
import { localized } from '../../common/i18n/localized-exception';
import { normaliseLicenceNumber, settleLicenceState } from './licence-rules';
import { CreateLicenseInput } from './dto/create-license.input';
import { UpdateLicenseInput } from './dto/update-license.input';
import {
  AddMyLicenseInput,
  UpdateMyLicenseInput,
} from './dto/my-license.input';
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

// The status of a licence a member entered or changed themselves.
export const MEMBER_LICENCE_STATUS = 'pending';

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

  // One number per licence type: checked here for a clear answer, and held
  // by a unique index for two requests at the same moment.
  private async assertNumberFree(licence: License): Promise<void> {
    const number = normaliseLicenceNumber(licence.license_number);
    if (!number) {
      return;
    }
    const sameType = await this.licenseRepository.find({
      where: { license_type: licence.license_type },
    });
    const taken = (sameType ?? []).some(
      (other) =>
        other.id !== licence.id &&
        normaliseLicenceNumber(other.license_number) === number,
    );
    if (taken) {
      throw localized(ConflictException, 'error.licence.numberAlreadyUsed');
    }
  }

  private async save(licence: License): Promise<License> {
    try {
      return await this.licenseRepository.save(licence);
    } catch (error) {
      const violated =
        (error?.driverError?.code ?? error?.code) === '23505' &&
        String(
          error?.driverError?.constraint ?? error?.constraint ?? '',
        ).includes(LICENCE_NUMBER_UNIQUE_INDEX);
      if (violated) {
        throw localized(ConflictException, 'error.licence.numberAlreadyUsed');
      }
      throw error;
    }
  }

  async create(createLicenseInput: CreateLicenseInput): Promise<License> {
    const { user_id, ...licenseData } = createLicenseInput;

    const user = await this.usersService.findOneById(user_id);
    if (!user) {
      throw new NotFoundException(`User with ID ${user_id} not found.`);
    }

    const license = this.licenseRepository.create({
      ...licenseData,
      license_number: licenseData.license_number?.trim(),
      user,
    });
    Object.assign(
      license,
      settleLicenceState(license, { status: licenseData.status }),
    );
    await this.assertNumberFree(license);

    return this.save(license);
  }

  async update(updateLicenseInput: UpdateLicenseInput): Promise<License> {
    const license = await this.findOne(updateLicenseInput.id);
    // A field that is not sent keeps its value; the documents are only
    // replaced by an actual list.
    for (const [field, value] of Object.entries(updateLicenseInput)) {
      const notSent =
        value === undefined || (field === 'documents_url' && value === null);
      if (field !== 'id' && !notSent) {
        license[field] =
          field === 'license_number' && typeof value === 'string'
            ? value.trim()
            : value;
      }
    }
    // Status and validity are settled together, from what was asked and
    // from the expiry date (see licence-rules).
    Object.assign(
      license,
      settleLicenceState(license, {
        status: updateLicenseInput.status,
        is_valid: updateLicenseInput.is_valid,
      }),
    );
    if (
      updateLicenseInput.license_number !== undefined ||
      updateLicenseInput.license_type !== undefined
    ) {
      await this.assertNumberFree(license);
    }
    return this.save(license);
  }

  // A member's own licences, the most recent first.
  async findOfMember(userId: number): Promise<License[]> {
    return this.licenseRepository.find({
      where: { user: { id: userId } },
      order: { id: 'DESC' },
    });
  }

  // A licence a member enters for themselves waits for an administrator:
  // pending, not valid, until validate().
  async addForMember(
    userId: number,
    input: AddMyLicenseInput,
    documentsUrl: string[] | null,
  ): Promise<License> {
    return this.create({
      ...input,
      user_id: userId,
      status: MEMBER_LICENCE_STATUS,
      ...(documentsUrl && { documents_url: documentsUrl }),
    } as CreateLicenseInput);
  }

  // A member changes their own licence only. Whatever it was, it waits for
  // an administrator again (an expired date stays expired).
  async updateForMember(
    userId: number,
    input: UpdateMyLicenseInput,
    documentsUrl: string[] | null,
  ): Promise<License> {
    const licence = await this.findOne(input.id);
    if (Number(licence.user?.id) !== Number(userId)) {
      throw localized(ForbiddenException, 'error.licence.notYours');
    }
    return this.update({
      ...input,
      status: MEMBER_LICENCE_STATUS,
      ...(documentsUrl && { documents_url: documentsUrl }),
    } as UpdateLicenseInput);
  }

  // An administrator validates a licence a member entered. Returns the
  // licence and its status before.
  async validate(
    id: number,
  ): Promise<{ licence: License; previousStatus: string }> {
    const licence = await this.findOne(id);
    const previousStatus = licence.status;
    Object.assign(licence, settleLicenceState(licence, { status: 'active' }));
    return { licence: await this.save(licence), previousStatus };
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

  // Licences not yet marked expired whose expiry date falls within the
  // given number of days, or has passed.
  async findExpiringLicenses(
    thresholdDays: number = 7,
    now: Date = new Date(),
  ): Promise<License[]> {
    const thresholdDate = new Date(
      now.getTime() + thresholdDays * 24 * 60 * 60 * 1000,
    );
    return this.licenseRepository.find({
      where: {
        expiration_date: LessThanOrEqual(thresholdDate),
        status: Not('expired') as never,
      },
      relations: ['user'],
      order: { expiration_date: 'ASC' },
    });
  }

  // Records that the reminder of a step was sent for the current expiry
  // date. False when it already was (another instance of the job, a
  // restart): the caller then sends nothing.
  async claimExpiryReminder(licence: License, step: number): Promise<boolean> {
    const rows = await this.licenseRepository.query(
      `UPDATE "licenses"
       SET "expiry_reminder_days" = $1, "expiry_reminder_for" = "expiration_date"
       WHERE "id" = $2
         AND "expiration_date" IS NOT NULL
         AND ("expiry_reminder_for" IS DISTINCT FROM "expiration_date"
              OR "expiry_reminder_days" IS NULL
              OR "expiry_reminder_days" > $1)
       RETURNING "id"`,
      [step, licence.id],
    );
    const returned = Array.isArray(rows?.[0]) ? rows[0] : rows;
    return Array.isArray(returned) && returned.length > 0;
  }
}
