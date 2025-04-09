import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { AuditService } from './audit.service';
import { Audit } from './entity/audit.entity';
import { AuditItem } from './entity/audit-item.entity';
import { AuditTemplate } from './entity/audit-template.entity';
import { CreateAuditInput } from './dto/create-audit.input';
import { UpdateAuditInput } from './dto/update-audit.input';
import { AuditFilterInput } from './dto/audit-filter.input';
import { CreateAuditItemInput } from './dto/create-audit-item.input';
import { UpdateAuditItemInput } from './dto/update-audit-item.input';
import { CreateAuditTemplateInput } from './dto/create-audit-template.input';
import { UpdateAuditTemplateInput } from './dto/update-audit-template.input';
import { AuditStatistics } from './dto/audit-statistics.input';
import { AuditResultType } from './enums/audit-result.enum';
import { AuditFrequencyType } from './enums/audit-frequency.enum';
import { AuditCategoryType } from './enums/audit-category.enum';
import { CriticalityLevel } from './enums/criticality-level.enum';

@Resolver(() => Audit)
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  // ==================== AUDIT QUERIES ====================

  @Query(() => [Audit], { name: 'audits' })
  async findAllAudits(
    @Args('filter', { nullable: true }) filter?: AuditFilterInput,
  ): Promise<Audit[]> {
    return this.auditService.findAllAudits(filter);
  }

  @Query(() => Audit, { name: 'audit' })
  async findAuditById(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<Audit> {
    return this.auditService.findAuditById(id);
  }

  @Query(() => [Audit], { name: 'upcomingAudits' })
  async getUpcomingAudits(
    @Args('daysAhead', { type: () => Int, defaultValue: 30 }) daysAhead: number,
  ): Promise<Audit[]> {
    return this.auditService.getUpcomingAudits(daysAhead);
  }

  @Query(() => [Audit], { name: 'overdueAudits' })
  async getOverdueAudits(): Promise<Audit[]> {
    return this.auditService.getOverdueAudits();
  }

  // ==================== AUDIT MUTATIONS ====================

  @Mutation(() => Audit)
  async createAudit(
    @Args('createAuditInput') createAuditInput: CreateAuditInput,
  ): Promise<Audit> {
    return this.auditService.createAudit(createAuditInput);
  }

  @Mutation(() => Audit)
  async updateAudit(
    @Args('id', { type: () => Int }) id: number,
    @Args('updateAuditInput') updateAuditInput: UpdateAuditInput,
  ): Promise<Audit> {
    return this.auditService.updateAudit(id, updateAuditInput);
  }

  @Mutation(() => Boolean)
  async deleteAudit(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.auditService.deleteAudit(id);
  }

  @Mutation(() => AuditItem)
  async createAuditItem(
    @Args('auditId', { type: () => Int }) auditId: number,
    @Args('createItemInput') createItemInput: CreateAuditItemInput,
  ): Promise<AuditItem> {
    return this.auditService.createAuditItem(auditId, createItemInput);
  }

  @Mutation(() => AuditItem)
  async updateAuditItem(
    @Args('id', { type: () => Int }) id: number,
    @Args('updateItemInput') updateItemInput: UpdateAuditItemInput,
  ): Promise<AuditItem> {
    return this.auditService.updateAuditItem(id, updateItemInput);
  }

  @Mutation(() => Boolean)
  async deleteAuditItem(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.auditService.deleteAuditItem(id);
  }

  // ==================== TEMPLATE QUERIES ====================

  @Query(() => [AuditTemplate], { name: 'auditTemplates' })
  async findAllTemplates(): Promise<AuditTemplate[]> {
    return this.auditService.findAllTemplates();
  }

  @Query(() => AuditTemplate, { name: 'auditTemplate' })
  async findTemplateById(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<AuditTemplate> {
    return this.auditService.findTemplateById(id);
  }

  @Query(() => [AuditTemplate], { name: 'auditTemplatesForAircraftType' })
  async getTemplatesForAircraftType(
    @Args('aircraftType') aircraftType: string,
  ): Promise<AuditTemplate[]> {
    return this.auditService.getTemplatesForAircraftType(aircraftType);
  }

  // ==================== TEMPLATE MUTATIONS ====================

  @Mutation(() => AuditTemplate)
  async createAuditTemplate(
    @Args('createTemplateInput') createTemplateInput: CreateAuditTemplateInput,
  ): Promise<AuditTemplate> {
    return this.auditService.createTemplate(createTemplateInput);
  }

  @Mutation(() => AuditTemplate)
  async updateAuditTemplate(
    @Args('id', { type: () => Int }) id: number,
    @Args('updateTemplateInput') updateTemplateInput: UpdateAuditTemplateInput,
  ): Promise<AuditTemplate> {
    return this.auditService.updateTemplate(id, updateTemplateInput);
  }

  @Mutation(() => Boolean)
  async deleteAuditTemplate(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.auditService.deleteTemplate(id);
  }

  @Query(() => AuditStatistics, { name: 'auditStatistics' })
  async getAuditStatistics(
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
  ): Promise<AuditStatistics> {
    return this.auditService.getAuditStatistics(startDate, endDate);
  }

  @Query(() => [String], { name: 'auditResultTypes' })
  getAuditResultTypes() {
    return Object.values(AuditResultType);
  }

  @Query(() => [String], { name: 'auditFrequencyTypes' })
  getAuditFrequencyTypes() {
    return Object.values(AuditFrequencyType);
  }

  @Query(() => [String], { name: 'auditCategoryTypes' })
  getAuditCategoryTypes() {
    return Object.values(AuditCategoryType);
  }

  @Query(() => [String], { name: 'criticalityLevels' })
  getCriticalityLevels() {
    return Object.values(CriticalityLevel);
  }
}
