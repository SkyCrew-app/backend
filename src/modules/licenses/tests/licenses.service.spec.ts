import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicensesService } from '../licenses.service';
import { License } from '../entity/licenses.entity';
import { UsersService } from '../../users/users.service';

describe('LicensesService', () => {
  let service: LicensesService;
  let licenseRepo: Partial<Record<keyof Repository<License>, jest.Mock>>;
  let usersService: Partial<Record<keyof UsersService, jest.Mock>>;

  beforeEach(async () => {
    licenseRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    usersService = {
      findOneById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensesService,
        { provide: getRepositoryToken(License), useValue: licenseRepo },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<LicensesService>(LicensesService);
  });

  describe('findAll', () => {
    it('should return array of licenses', async () => {
      const result = [{ id: 1 } as License];
      (licenseRepo.find as jest.Mock).mockResolvedValue(result);
      expect(await service.findAll()).toBe(result);
    });
  });

  describe('findOne', () => {
    it('should return a license if found', async () => {
      const lic = { id: 2 } as License;
      (licenseRepo.findOne as jest.Mock).mockResolvedValue(lic);
      expect(await service.findOne(2)).toBe(lic);
      expect(licenseRepo.findOne).toHaveBeenCalledWith({
        where: { id: 2 },
        relations: ['user'],
      });
    });

    it('should throw if not found', async () => {
      (licenseRepo.findOne as jest.Mock).mockResolvedValue(undefined);
      await expect(service.findOne(3)).rejects.toThrow(
        'License with ID 3 not found.',
      );
    });
  });

  describe('create', () => {
    it('should create and save a license', async () => {
      const dto = {
        user_id: 5,
        license_type: 'A',
        issue_date: new Date(),
        license_number: '123',
      } as any;
      const user = { id: 5 } as any;
      (usersService.findOneById as jest.Mock).mockResolvedValue(user);
      const created = { id: 1, user, ...dto } as License;
      (licenseRepo.create as jest.Mock).mockReturnValue(created);
      (licenseRepo.save as jest.Mock).mockResolvedValue(created);

      expect(await service.create(dto)).toBe(created);
      expect(usersService.findOneById).toHaveBeenCalledWith(5);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { user_id, ...licenseData } = dto as any;
      expect(licenseRepo.create).toHaveBeenCalledWith({ user, ...licenseData });
      expect(licenseRepo.save).toHaveBeenCalledWith(created);
    });

    it('should throw if user not found', async () => {
      (usersService.findOneById as jest.Mock).mockResolvedValue(null);
      await expect(service.create({ user_id: 9 } as any)).rejects.toThrow(
        'User with ID 9 not found.',
      );
    });
  });

  describe('update', () => {
    it('should load and save updated license', async () => {
      const existing = { id: 4, license_type: 'B' } as any;
      (licenseRepo.findOne as jest.Mock).mockResolvedValue(existing);
      (licenseRepo.save as jest.Mock).mockResolvedValue(existing);
      const dto = { id: 4, license_type: 'C' } as any;

      expect(await service.update(dto)).toBe(existing);
      expect(licenseRepo.save).toHaveBeenCalledWith(existing);
      expect(existing.license_type).toBe('C');
    });

    it('should throw if license not found', async () => {
      (licenseRepo.findOne as jest.Mock).mockResolvedValue(undefined);
      await expect(service.update({ id: 7 } as any)).rejects.toThrow(
        'License with ID 7 not found.',
      );
    });
  });

  describe('remove', () => {
    it('should return true when deleted', async () => {
      (licenseRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
      expect(await service.remove(8)).toBe(true);
    });

    it('should throw if no record deleted', async () => {
      (licenseRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });
      await expect(service.remove(9)).rejects.toThrow(
        'License with ID 9 not found.',
      );
    });
  });

  describe('findExpiringLicenses', () => {
    it('should call repository with correct filter', async () => {
      const thresholdDays = 7;
      const list = [];
      (licenseRepo.find as jest.Mock).mockResolvedValue(list);
      expect(await service.findExpiringLicenses(thresholdDays)).toBe(list);
      expect(licenseRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'active',
          expiration_date: expect.any(Object),
        }),
        relations: ['user'],
      });
    });
  });
});
