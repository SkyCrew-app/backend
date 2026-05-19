import { Test, TestingModule } from '@nestjs/testing';
import { LicensesResolver } from '../licenses.resolver';
import { LicensesService } from '../licenses.service';
import { License } from '../entity/licenses.entity';

describe('LicensesResolver', () => {
  let resolver: LicensesResolver;
  let service: Partial<Record<keyof LicensesService, jest.Mock>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      uploadFiles: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensesResolver,
        { provide: LicensesService, useValue: service },
      ],
    }).compile();

    resolver = module.get<LicensesResolver>(LicensesResolver);
  });

  it('getAllLicenses should call service.findAll', () => {
    const arr = [] as License[];
    (service.findAll as jest.Mock).mockReturnValue(arr);
    expect(resolver.findAll()).toBe(arr);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('getLicenseById should call service.findOne', () => {
    const lic = {} as License;
    (service.findOne as jest.Mock).mockReturnValue(lic);
    expect(resolver.findOne(3)).toBe(lic);
    expect(service.findOne).toHaveBeenCalledWith(3);
  });

  it('createLicense should upload files and call service.create', async () => {
    const dto = { user_id: 1 } as any;
    const files = [] as any;
    const paths = ['url1'];
    (service.uploadFiles as jest.Mock).mockResolvedValue(paths);
    const lic = {} as License;
    (service.create as jest.Mock).mockReturnValue(lic);

    const result = await resolver.createLicense(dto, files);
    expect(service.uploadFiles).toHaveBeenCalledWith(files);
    expect(service.create).toHaveBeenCalledWith({
      ...dto,
      documents_url: paths,
    });
    expect(result).toBe(lic);
  });

  it('updateLicense should upload files and call service.update', async () => {
    const dto = { id: 2 } as any;
    const files = [] as any;
    const paths = ['url2'];
    (service.uploadFiles as jest.Mock).mockResolvedValue(paths);
    const lic = {} as License;
    (service.update as jest.Mock).mockReturnValue(lic);

    const result = await resolver.updateLicense(dto, files);
    expect(service.uploadFiles).toHaveBeenCalledWith(files);
    expect(service.update).toHaveBeenCalledWith({
      ...dto,
      documents_url: paths,
    });
    expect(result).toBe(lic);
  });

  it('deleteLicense should call service.remove', () => {
    (service.remove as jest.Mock).mockReturnValue(true);
    expect(resolver.deleteLicense(4)).toBe(true);
    expect(service.remove).toHaveBeenCalledWith(4);
  });
});
