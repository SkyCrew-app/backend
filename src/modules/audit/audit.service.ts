import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { Audit } from './entity/audit.entity';
import { AuditItem } from './entity/audit-item.entity';
import { AuditTemplate } from './entity/audit-template.entity';
import { AuditTemplateItem } from './entity/audit-template-item.entity';
import { CreateAuditInput } from './dto/create-audit.input';
import { UpdateAuditInput } from './dto/update-audit.input';
import { AuditFilterInput } from './dto/audit-filter.input';
import { CreateAuditItemInput } from './dto/create-audit-item.input';
import { UpdateAuditItemInput } from './dto/update-audit-item.input';
import { CreateAuditTemplateInput } from './dto/create-audit-template.input';
import { UpdateAuditTemplateInput } from './dto/update-audit-template.input';
import { AuditStatistics } from './dto/audit-statistics.input';
import { AircraftService } from '../aircraft/aircraft.service';
import { UsersService } from '../users/users.service';
import { AuditResultType } from './enums/audit-result.enum';
import { calculateNextAuditDate } from './enums/audit-frequency.enum';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(Audit)
    private auditRepository: Repository<Audit>,
    @InjectRepository(AuditItem)
    private auditItemRepository: Repository<AuditItem>,
    @InjectRepository(AuditTemplate)
    private auditTemplateRepository: Repository<AuditTemplate>,
    @InjectRepository(AuditTemplateItem)
    private auditTemplateItemRepository: Repository<AuditTemplateItem>,
    private aircraftService: AircraftService,
    private usersService: UsersService,
  ) {}

  // ==================== AUDIT METHODS ====================

  async findAllAudits(filterInput?: AuditFilterInput): Promise<Audit[]> {
    const where: FindOptionsWhere<Audit> = {};

    if (filterInput) {
      if (filterInput.aircraftId) {
        where.aircraft = { id: filterInput.aircraftId };
      }

      if (filterInput.auditResult) {
        where.audit_result = filterInput.auditResult;
      }

      if (filterInput.isClosed !== undefined) {
        where.is_closed = filterInput.isClosed;
      }

      if (filterInput.startDate && filterInput.endDate) {
        where.audit_date = Between(filterInput.startDate, filterInput.endDate);
      } else if (filterInput.startDate) {
        where.audit_date = MoreThanOrEqual(filterInput.startDate);
      } else if (filterInput.endDate) {
        where.audit_date = LessThanOrEqual(filterInput.endDate);
      }
    }

    return this.auditRepository.find({
      where,
      relations: ['aircraft', 'auditor', 'audit_items', 'closed_by'],
      order: { audit_date: 'DESC' },
    });
  }

  async findAuditById(id: number): Promise<Audit> {
    const audit = await this.auditRepository.findOne({
      where: { id },
      relations: ['aircraft', 'auditor', 'audit_items', 'closed_by'],
    });

    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    return audit;
  }

  async createAudit(createAuditInput: CreateAuditInput): Promise<Audit> {
    const { aircraftId, auditorId, templateId, ...auditData } =
      createAuditInput;

    const aircraft = await this.aircraftService.findOne(aircraftId);
    const auditor = await this.usersService.findOneById(auditorId);
    const audit = this.auditRepository.create({
      ...auditData,
      aircraft,
      auditor,
      audit_items: [],
    });

    if (templateId) {
      const template = await this.findTemplateById(templateId);

      const auditItems: AuditItem[] = [];

      for (const templateItem of template.items) {
        const auditItem = this.auditItemRepository.create({
          category: templateItem.category,
          description: templateItem.title,
          notes: templateItem.description,
          result: AuditResultType.CONFORME,
        });

        const savedItem = await this.auditItemRepository.save(auditItem);
        auditItems.push(savedItem);
      }

      audit.audit_items = auditItems;
    }

    if (audit.audit_frequency && !audit.next_audit_date) {
      audit.next_audit_date = calculateNextAuditDate(
        audit.audit_date,
        audit.audit_frequency,
      );
    }

    return this.auditRepository.save(audit);
  }

  async updateAudit(
    id: number,
    updateAuditInput: UpdateAuditInput,
  ): Promise<Audit> {
    const audit = await this.findAuditById(id);

    if (audit.is_closed && !updateAuditInput.is_closed) {
      throw new BadRequestException('Cannot modify a closed audit');
    }

    if (updateAuditInput.aircraftId) {
      audit.aircraft = await this.aircraftService.findOne(
        updateAuditInput.aircraftId,
      );
    }

    if (updateAuditInput.audit_date !== undefined) {
      audit.audit_date = updateAuditInput.audit_date;
    }

    if (updateAuditInput.audit_result !== undefined) {
      audit.audit_result = updateAuditInput.audit_result;
    }

    if (updateAuditInput.audit_notes !== undefined) {
      audit.audit_notes = updateAuditInput.audit_notes;
    }

    if (updateAuditInput.corrective_actions !== undefined) {
      audit.corrective_actions = updateAuditInput.corrective_actions;
    }

    if (updateAuditInput.audit_frequency !== undefined) {
      audit.audit_frequency = updateAuditInput.audit_frequency;
    }

    if (updateAuditInput.is_closed === true && !audit.is_closed) {
      audit.is_closed = true;
      audit.closed_date = new Date();

      if (updateAuditInput.closedById) {
        audit.closed_by = await this.usersService.findOneById(
          updateAuditInput.closedById,
        );
      }
    }

    if (updateAuditInput.audit_frequency || updateAuditInput.audit_date) {
      const date = updateAuditInput.audit_date || audit.audit_date;
      const frequency =
        updateAuditInput.audit_frequency || audit.audit_frequency;
      audit.next_audit_date = calculateNextAuditDate(date, frequency);
    } else if (updateAuditInput.next_audit_date !== undefined) {
      audit.next_audit_date = updateAuditInput.next_audit_date;
    }

    return this.auditRepository.save(audit);
  }

  async deleteAudit(id: number): Promise<boolean> {
    const audit = await this.findAuditById(id);

    if (audit.audit_items && audit.audit_items.length > 0) {
      await this.auditItemRepository.remove(audit.audit_items);
    }

    await this.auditRepository.remove(audit);

    return true;
  }

  async createAuditItem(
    auditId: number,
    createItemInput: CreateAuditItemInput,
  ): Promise<AuditItem> {
    const audit = await this.findAuditById(auditId);

    if (audit.is_closed) {
      throw new BadRequestException('Cannot add items to a closed audit');
    }

    const auditItem = this.auditItemRepository.create(createItemInput);
    const savedItem = await this.auditItemRepository.save(auditItem);

    if (!audit.audit_items) {
      audit.audit_items = [];
    }

    audit.audit_items.push(savedItem);
    await this.auditRepository.save(audit);

    return savedItem;
  }

  async updateAuditItem(
    id: number,
    updateItemInput: UpdateAuditItemInput,
  ): Promise<AuditItem> {
    const auditItem = await this.auditItemRepository.findOne({ where: { id } });

    if (!auditItem) {
      throw new NotFoundException(`Audit item with ID ${id} not found`);
    }

    Object.assign(auditItem, updateItemInput);

    return this.auditItemRepository.save(auditItem);
  }

  async deleteAuditItem(id: number): Promise<boolean> {
    const auditItem = await this.auditItemRepository.findOne({ where: { id } });

    if (!auditItem) {
      throw new NotFoundException(`Audit item with ID ${id} not found`);
    }

    await this.auditItemRepository.remove(auditItem);

    return true;
  }

  async getUpcomingAudits(daysAhead: number = 30): Promise<Audit[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    return this.auditRepository.find({
      where: {
        next_audit_date: Between(today, futureDate),
        is_closed: false,
      },
      relations: ['aircraft', 'auditor'],
      order: { next_audit_date: 'ASC' },
    });
  }

  async getOverdueAudits(): Promise<Audit[]> {
    const today = new Date();

    return this.auditRepository.find({
      where: {
        next_audit_date: LessThanOrEqual(today),
        is_closed: false,
      },
      relations: ['aircraft', 'auditor'],
      order: { next_audit_date: 'ASC' },
    });
  }

  // ==================== TEMPLATE METHODS ====================

  async findAllTemplates(): Promise<AuditTemplate[]> {
    return this.auditTemplateRepository.find({
      relations: ['items', 'created_by'],
      order: { name: 'ASC' },
    });
  }

  async findTemplateById(id: number): Promise<AuditTemplate> {
    const template = await this.auditTemplateRepository.findOne({
      where: { id },
      relations: ['items', 'created_by'],
    });

    if (!template) {
      throw new NotFoundException(`Audit template with ID ${id} not found`);
    }

    return template;
  }

  async createTemplate(
    createTemplateInput: CreateAuditTemplateInput,
  ): Promise<AuditTemplate> {
    const { createdById, items, ...templateData } = createTemplateInput;

    const createdBy = await this.usersService.findOneById(createdById);

    const template = this.auditTemplateRepository.create({
      ...templateData,
      created_by: createdBy,
      version: 1,
    });

    const savedTemplate = await this.auditTemplateRepository.save(template);

    if (items && items.length > 0) {
      const templateItems = items.map((item, index) =>
        this.auditTemplateItemRepository.create({
          ...item,
          template: savedTemplate,
          order_index: item.order_index || index + 1,
        }),
      );

      savedTemplate.items =
        await this.auditTemplateItemRepository.save(templateItems);
    }

    return savedTemplate;
  }

  async updateTemplate(
    id: number,
    updateTemplateInput: UpdateAuditTemplateInput,
  ): Promise<AuditTemplate> {
    const template = await this.findTemplateById(id);
    const { items, ...templateData } = updateTemplateInput;

    Object.assign(template, templateData);

    template.version += 1;

    const updatedTemplate = await this.auditTemplateRepository.save(template);

    if (items && items.length > 0) {
      if (template.items && template.items.length > 0) {
        await this.auditTemplateItemRepository.remove(template.items);
      }

      const templateItems = items.map((item, index) =>
        this.auditTemplateItemRepository.create({
          ...item,
          template: updatedTemplate,
          order_index: item.order_index || index + 1,
        }),
      );

      updatedTemplate.items =
        await this.auditTemplateItemRepository.save(templateItems);
    }

    return updatedTemplate;
  }

  async deleteTemplate(id: number): Promise<boolean> {
    const template = await this.findTemplateById(id);

    if (template.items && template.items.length > 0) {
      await this.auditTemplateItemRepository.remove(template.items);
    }

    await this.auditTemplateRepository.remove(template);

    return true;
  }

  async getTemplatesForAircraftType(
    aircraftType: string,
  ): Promise<AuditTemplate[]> {
    return this.auditTemplateRepository.find({
      where: [
        { applicable_aircraft_types: aircraftType },
        { applicable_aircraft_types: null },
      ],
      relations: ['items'],
      order: { name: 'ASC' },
    });
  }

  async getAuditStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditStatistics> {
    const where: FindOptionsWhere<Audit> = {};

    if (startDate && endDate) {
      where.audit_date = Between(startDate, endDate);
    } else if (startDate) {
      where.audit_date = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.audit_date = LessThanOrEqual(endDate);
    }

    const audits = await this.auditRepository.find({
      where,
      relations: ['aircraft'],
    });

    const statistics: AuditStatistics = {
      totalAudits: audits.length,
      conformCount: 0,
      nonConformCount: 0,
      conformWithRemarksCount: 0,
      openAudits: 0,
      closedAudits: 0,
      auditsByAircraft: [],
      auditsByMonth: [],
    };

    const aircraftStatsMap = new Map<
      number,
      { auditCount: number; nonConformCount: number; registration: string }
    >();

    const monthlyStatsMap = new Map<
      string,
      { month: number; year: number; count: number }
    >();

    for (const audit of audits) {
      if (audit.audit_result === AuditResultType.CONFORME) {
        statistics.conformCount++;
      } else if (audit.audit_result === AuditResultType.NON_CONFORME) {
        statistics.nonConformCount++;
      } else if (
        audit.audit_result === AuditResultType.CONFORME_AVEC_REMARQUES
      ) {
        statistics.conformWithRemarksCount++;
      }

      if (audit.is_closed) {
        statistics.closedAudits++;
      } else {
        statistics.openAudits++;
      }

      const aircraftId = audit.aircraft.id;
      const registration = audit.aircraft.registration_number;

      if (!aircraftStatsMap.has(aircraftId)) {
        aircraftStatsMap.set(aircraftId, {
          auditCount: 0,
          nonConformCount: 0,
          registration,
        });
      }

      const aircraftStats = aircraftStatsMap.get(aircraftId);
      aircraftStats.auditCount++;

      if (audit.audit_result === AuditResultType.NON_CONFORME) {
        aircraftStats.nonConformCount++;
      }

      const date = new Date(audit.audit_date);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const monthYearKey = `${month}-${year}`;

      if (!monthlyStatsMap.has(monthYearKey)) {
        monthlyStatsMap.set(monthYearKey, { month, year, count: 0 });
      }

      monthlyStatsMap.get(monthYearKey).count++;
    }

    statistics.auditsByAircraft = Array.from(aircraftStatsMap.entries()).map(
      ([aircraftId, stats]) => ({
        aircraftId,
        registration: stats.registration,
        auditCount: stats.auditCount,
        nonConformCount: stats.nonConformCount,
      }),
    );

    statistics.auditsByMonth = Array.from(monthlyStatsMap.values());

    return statistics;
  }
}
