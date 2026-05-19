import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { Audit } from '../entity/audit.entity';
import { AuditItem } from '../entity/audit-item.entity';
import { AuditTemplate } from '../entity/audit-template.entity';
import { AuditTemplateItem } from '../entity/audit-template-item.entity';
import { AircraftService } from '../../aircraft/aircraft.service';
import { UsersService } from '../../users/users.service';
import { AuditResultType } from '../enums/audit-result.enum';
import { AuditFrequencyType } from '../enums/audit-frequency.enum';

// Utility to create repository mocks
const createRepositoryMock = <T = any>(): Partial<
  Record<keyof Repository<T>, jest.Mock>
> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

describe('AuditService', () => {
  let service: AuditService;
  let auditRepo: Partial<Record<keyof Repository<Audit>, jest.Mock>>;
  let auditItemRepo: Partial<Record<keyof Repository<AuditItem>, jest.Mock>>;
  let templateRepo: Partial<Record<keyof Repository<AuditTemplate>, jest.Mock>>;
  let templateItemRepo: Partial<
    Record<keyof Repository<AuditTemplateItem>, jest.Mock>
  >;
  let aircraftService: Partial<Record<keyof AircraftService, jest.Mock>>;
  let usersService: Partial<Record<keyof UsersService, jest.Mock>>;

  beforeEach(async () => {
    auditRepo = createRepositoryMock<Audit>();
    auditItemRepo = createRepositoryMock<AuditItem>();
    templateRepo = createRepositoryMock<AuditTemplate>();
    templateItemRepo = createRepositoryMock<AuditTemplateItem>();
    aircraftService = { findOne: jest.fn() };
    usersService = { findOneById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(Audit), useValue: auditRepo },
        { provide: getRepositoryToken(AuditItem), useValue: auditItemRepo },
        { provide: getRepositoryToken(AuditTemplate), useValue: templateRepo },
        {
          provide: getRepositoryToken(AuditTemplateItem),
          useValue: templateItemRepo,
        },
        { provide: AircraftService, useValue: aircraftService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('findAllAudits', () => {
    it('returns audits without filter', async () => {
      const expected = [{ id: 1 } as Audit];
      auditRepo.find.mockResolvedValue(expected);
      const result = await service.findAllAudits();
      expect(auditRepo.find).toHaveBeenCalledWith({
        where: {},
        relations: ['aircraft', 'auditor', 'audit_items', 'closed_by'],
        order: { audit_date: 'DESC' },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('findAuditById', () => {
    it('returns audit when found', async () => {
      const audit = { id: 2 } as Audit;
      auditRepo.findOne.mockResolvedValue(audit);
      const result = await service.findAuditById(2);
      expect(auditRepo.findOne).toHaveBeenCalledWith({
        where: { id: 2 },
        relations: ['aircraft', 'auditor', 'audit_items', 'closed_by'],
      });
      expect(result).toEqual(audit);
    });

    it('throws NotFoundException when not found', async () => {
      auditRepo.findOne.mockResolvedValue(undefined);
      await expect(service.findAuditById(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAudit', () => {
    it('creates audit without template', async () => {
      const dto = {
        aircraftId: 1,
        auditorId: 2,
        audit_date: new Date(),
        audit_result: AuditResultType.CONFORME,
        audit_frequency: AuditFrequencyType.ANNUEL,
      } as any;
      const aircraft = { id: 1 };
      const auditor = { id: 2 };
      aircraftService.findOne.mockResolvedValue(aircraft);
      usersService.findOneById.mockResolvedValue(auditor);
      auditRepo.create.mockReturnValue({ ...dto, aircraft, auditor });
      auditRepo.save.mockResolvedValue({ id: 10 } as Audit);

      const result = await service.createAudit(dto);
      expect(aircraftService.findOne).toHaveBeenCalledWith(1);
      expect(usersService.findOneById).toHaveBeenCalledWith(2);
      expect(auditRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(10);
    });

    it('includes items when templateId provided', async () => {
      const dto = {
        aircraftId: 1,
        auditorId: 2,
        templateId: 5,
        audit_date: new Date(),
        audit_result: AuditResultType.CONFORME,
        audit_frequency: AuditFrequencyType.ANNUEL,
      } as any;
      const aircraft = { id: 1 };
      const auditor = { id: 2 };
      const template = {
        id: 5,
        items: [{ category: 'AUTRE', title: 'T', description: 'D' }],
      } as any;
      aircraftService.findOne.mockResolvedValue(aircraft);
      usersService.findOneById.mockResolvedValue(auditor);
      jest.spyOn(service, 'findTemplateById').mockResolvedValue(template);
      auditItemRepo.create.mockImplementation((item) => item as any);
      auditItemRepo.save.mockResolvedValue({
        ...template.items[0],
        id: 100,
      } as AuditItem);
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({ id: 20 } as Audit);

      const res = await service.createAudit(dto);
      expect(service.findTemplateById).toHaveBeenCalledWith(5);
      expect(auditItemRepo.save).toHaveBeenCalled();
      expect(res.id).toBe(20);
    });
  });

  describe('updateAudit', () => {
    it('throws when modifying closed audit', async () => {
      const existing = { id: 1, is_closed: true } as any;
      jest.spyOn(service, 'findAuditById').mockResolvedValue(existing);
      await expect(
        service.updateAudit(1, { is_closed: false } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAudit', () => {
    it('removes items and audit', async () => {
      const audit = { id: 1, audit_items: [{ id: 5 }] } as any;
      jest.spyOn(service, 'findAuditById').mockResolvedValue(audit);
      auditItemRepo.remove.mockResolvedValue(null);
      auditRepo.remove.mockResolvedValue(null);
      const res = await service.deleteAudit(1);
      expect(auditItemRepo.remove).toHaveBeenCalledWith(audit.audit_items);
      expect(auditRepo.remove).toHaveBeenCalledWith(audit);
      expect(res).toBe(true);
    });
  });

  describe('createAuditItem', () => {
    it('adds item to audit', async () => {
      const audit = { id: 1, is_closed: false, audit_items: [] } as any;
      jest.spyOn(service, 'findAuditById').mockResolvedValue(audit);
      const dto = {
        category: 'AUTRE',
        description: 'D',
        result: AuditResultType.CONFORME,
      };
      auditItemRepo.create.mockReturnValue(dto as any);
      auditItemRepo.save.mockResolvedValue({ id: 10, ...dto } as any);
      auditRepo.save.mockResolvedValue(null as any);

      const item = await service.createAuditItem(1, dto as any);
      expect(item.id).toBe(10);
      expect(auditRepo.save).toHaveBeenCalled();
    });
  });

  describe('updateAuditItem', () => {
    it('updates existing item', async () => {
      const item = { id: 3 } as any;
      auditItemRepo.findOne.mockResolvedValue(item);
      auditItemRepo.save.mockResolvedValue(item);
      const res = await service.updateAuditItem(3, { description: 'X' } as any);
      expect(auditItemRepo.save).toHaveBeenCalledWith(item);
      expect(res).toBe(item);
    });

    it('throws if not found', async () => {
      auditItemRepo.findOne.mockResolvedValue(undefined);
      await expect(service.updateAuditItem(99, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAuditItem', () => {
    it('removes item', async () => {
      const item = { id: 4 } as any;
      auditItemRepo.findOne.mockResolvedValue(item);
      auditItemRepo.remove.mockResolvedValue(null);
      const res = await service.deleteAuditItem(4);
      expect(auditItemRepo.remove).toHaveBeenCalledWith(item);
      expect(res).toBe(true);
    });
  });

  describe('getUpcomingAudits', () => {
    it('queries next audits', async () => {
      const list = [{ id: 1 } as Audit];
      auditRepo.find.mockResolvedValue(list);
      const res = await service.getUpcomingAudits(7);
      expect(auditRepo.find).toHaveBeenCalled();
      expect(res).toBe(list);
    });
  });

  describe('getOverdueAudits', () => {
    it('queries overdue audits', async () => {
      auditRepo.find.mockResolvedValue([]);
      const res = await service.getOverdueAudits();
      expect(auditRepo.find).toHaveBeenCalled();
      expect(res).toEqual([]);
    });
  });

  describe('Template methods', () => {
    it('findAllTemplates calls repo.find', async () => {
      templateRepo.find.mockResolvedValue([{ id: 1 } as AuditTemplate]);
      const res = await service.findAllTemplates();
      expect(templateRepo.find).toHaveBeenCalled();
      expect(res.length).toBe(1);
    });

    it('findTemplateById throws if missing', async () => {
      templateRepo.findOne.mockResolvedValue(undefined);
      await expect(service.findTemplateById(5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAuditStatistics', () => {
    it('aggregates stats', async () => {
      const base = {
        id: 1,
        audit_result: AuditResultType.NON_CONFORME,
        is_closed: false,
        audit_date: new Date('2025-01-15'),
        aircraft: { id: 1, registration_number: 'X123' },
      } as any;
      auditRepo.find.mockResolvedValue([base]);
      const stats = await service.getAuditStatistics();
      expect(stats.totalAudits).toBe(1);
      expect(stats.nonConformCount).toBe(1);
      expect(stats.auditsByAircraft[0].nonConformCount).toBe(1);
    });
  });
});
