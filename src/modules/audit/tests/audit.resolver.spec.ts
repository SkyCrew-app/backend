import { Test, TestingModule } from '@nestjs/testing';
import { AuditResolver } from '../audit.resolver';
import { AuditService } from '../audit.service';
import { Audit } from '../entity/audit.entity';
import { AuditItem } from '../entity/audit-item.entity';
import { AuditTemplate } from '../entity/audit-template.entity';
import { CreateAuditInput } from '../dto/create-audit.input';
import { UpdateAuditInput } from '../dto/update-audit.input';
import { CreateAuditItemInput } from '../dto/create-audit-item.input';
import { UpdateAuditItemInput } from '../dto/update-audit-item.input';
import { CreateAuditTemplateInput } from '../dto/create-audit-template.input';
import { UpdateAuditTemplateInput } from '../dto/update-audit-template.input';
import { AuditStatistics } from '../dto/audit-statistics.input';
import { AuditResultType } from '../enums/audit-result.enum';
import { AuditFrequencyType } from '../enums/audit-frequency.enum';
import { AuditCategoryType } from '../enums/audit-category.enum';
import { CriticalityLevel } from '../enums/criticality-level.enum';

const mockService = () => ({
  findAllAudits: jest.fn(),
  findAuditById: jest.fn(),
  getUpcomingAudits: jest.fn(),
  getOverdueAudits: jest.fn(),
  createAudit: jest.fn(),
  updateAudit: jest.fn(),
  deleteAudit: jest.fn(),
  createAuditItem: jest.fn(),
  updateAuditItem: jest.fn(),
  deleteAuditItem: jest.fn(),
  findAllTemplates: jest.fn(),
  findTemplateById: jest.fn(),
  getTemplatesForAircraftType: jest.fn(),
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  getAuditStatistics: jest.fn(),
});

describe('AuditResolver', () => {
  let resolver: AuditResolver;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditResolver,
        { provide: AuditService, useFactory: mockService },
      ],
    }).compile();

    resolver = module.get<AuditResolver>(AuditResolver);
    service = module.get<AuditService>(AuditService) as any;
  });

  it('calls service.findAllAudits via audits query', async () => {
    const audits: Audit[] = [];
    service.findAllAudits.mockResolvedValue(audits);
    expect(await resolver.findAllAudits()).toBe(audits);
    expect(service.findAllAudits).toHaveBeenCalled();
  });

  it('calls service.findAuditById via audit query', async () => {
    const audit = new Audit();
    audit.id = 1;
    service.findAuditById.mockResolvedValue(audit);
    expect(await resolver.findAuditById(1)).toBe(audit);
    expect(service.findAuditById).toHaveBeenCalledWith(1);
  });

  it('calls service.getUpcomingAudits via upcomingAudits', async () => {
    service.getUpcomingAudits.mockResolvedValue([]);
    expect(await resolver.getUpcomingAudits(5)).toEqual([]);
    expect(service.getUpcomingAudits).toHaveBeenCalledWith(5);
  });

  it('calls service.getOverdueAudits via overdueAudits', async () => {
    service.getOverdueAudits.mockResolvedValue([]);
    expect(await resolver.getOverdueAudits()).toEqual([]);
    expect(service.getOverdueAudits).toHaveBeenCalled();
  });

  it('calls service.createAudit via createAudit mutation', async () => {
    const dto: CreateAuditInput = {
      aircraftId: 1,
      auditorId: 2,
      audit_date: new Date(),
      audit_result: AuditResultType.CONFORME,
      audit_frequency: null,
    };
    service.createAudit.mockResolvedValue({ id: 1 } as Audit);
    expect(await resolver.createAudit(dto)).toEqual({ id: 1 });
    expect(service.createAudit).toHaveBeenCalledWith(dto);
  });

  it('calls service.updateAudit via updateAudit mutation', async () => {
    const dto: UpdateAuditInput = {} as any;
    service.updateAudit.mockResolvedValue({ id: 2 } as Audit);
    expect(await resolver.updateAudit(2, dto)).toEqual({ id: 2 });
    expect(service.updateAudit).toHaveBeenCalledWith(2, dto);
  });

  it('calls service.deleteAudit via deleteAudit mutation', async () => {
    service.deleteAudit.mockResolvedValue(true);
    expect(await resolver.deleteAudit(3)).toBe(true);
    expect(service.deleteAudit).toHaveBeenCalledWith(3);
  });

  it('calls service.createAuditItem via createAuditItem mutation', async () => {
    const dto: CreateAuditItemInput = {
      category: AuditCategoryType.AUTRE,
      description: 'D',
      result: AuditResultType.CONFORME,
    };
    service.createAuditItem.mockResolvedValue({ id: 5 } as AuditItem);
    expect(await resolver.createAuditItem(1, dto)).toEqual({ id: 5 });
    expect(service.createAuditItem).toHaveBeenCalledWith(1, dto);
  });

  it('calls service.updateAuditItem via updateAuditItem mutation', async () => {
    const dto: UpdateAuditItemInput = { description: 'X' } as any;
    service.updateAuditItem.mockResolvedValue({ id: 6 } as AuditItem);
    expect(await resolver.updateAuditItem(6, dto)).toEqual({ id: 6 });
    expect(service.updateAuditItem).toHaveBeenCalledWith(6, dto);
  });

  it('calls service.deleteAuditItem via deleteAuditItem mutation', async () => {
    service.deleteAuditItem.mockResolvedValue(true);
    expect(await resolver.deleteAuditItem(7)).toBe(true);
    expect(service.deleteAuditItem).toHaveBeenCalledWith(7);
  });

  it('calls service.findAllTemplates via auditTemplates query', async () => {
    service.findAllTemplates.mockResolvedValue([{ id: 1 } as AuditTemplate]);
    expect(await resolver.findAllTemplates()).toEqual([{ id: 1 }]);
  });

  it('calls service.findTemplateById via auditTemplate query', async () => {
    service.findTemplateById.mockResolvedValue({ id: 2 } as AuditTemplate);
    expect(await resolver.findTemplateById(2)).toEqual({ id: 2 });
  });

  it('calls service.getTemplatesForAircraftType via auditTemplatesForAircraftType', async () => {
    service.getTemplatesForAircraftType.mockResolvedValue([]);
    expect(await resolver.getTemplatesForAircraftType('A')).toEqual([]);
  });

  it('calls service.createTemplate via createAuditTemplate mutation', async () => {
    const dto: CreateAuditTemplateInput = {} as any;
    service.createTemplate.mockResolvedValue({ id: 3 } as AuditTemplate);
    expect(await resolver.createAuditTemplate(dto)).toEqual({ id: 3 });
  });

  it('calls service.updateTemplate via updateAuditTemplate mutation', async () => {
    const dto: UpdateAuditTemplateInput = {} as any;
    service.updateTemplate.mockResolvedValue({ id: 4 } as AuditTemplate);
    expect(await resolver.updateAuditTemplate(4, dto)).toEqual({ id: 4 });
  });

  it('calls service.deleteTemplate via deleteAuditTemplate mutation', async () => {
    service.deleteTemplate.mockResolvedValue(true);
    expect(await resolver.deleteAuditTemplate(8)).toBe(true);
  });

  it('calls service.getAuditStatistics via auditStatistics query', async () => {
    service.getAuditStatistics.mockResolvedValue({
      totalAudits: 0,
    } as AuditStatistics);
    expect(await resolver.getAuditStatistics()).toEqual({ totalAudits: 0 });
    expect(service.getAuditStatistics).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
  });

  it('returns correct enum arrays', () => {
    expect(resolver.getAuditResultTypes()).toEqual(
      Object.values(AuditResultType),
    );
    expect(resolver.getAuditFrequencyTypes()).toEqual(
      Object.values(AuditFrequencyType),
    );
    expect(resolver.getAuditCategoryTypes()).toEqual(
      Object.values(AuditCategoryType),
    );
    expect(resolver.getCriticalityLevels()).toEqual(
      Object.values(CriticalityLevel),
    );
  });
});
