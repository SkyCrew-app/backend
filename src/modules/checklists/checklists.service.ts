import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplate } from './entity/checklist-template.entity';
import { ChecklistItem } from './entity/checklist-item.entity';
import {
  ChecklistSubmission,
  ChecklistSubmissionStatus,
} from './entity/checklist-submission.entity';
import { CreateChecklistTemplateInput } from './dto/create-checklist-template.input';
import { UpdateChecklistTemplateInput } from './dto/update-checklist-template.input';
import { CreateChecklistItemInput } from './dto/create-checklist-item.input';
import { UpdateChecklistItemInput } from './dto/update-checklist-item.input';
import { SubmitChecklistInput } from './dto/submit-checklist.input';
import { UpdateChecklistSubmissionInput } from './dto/update-checklist-submission.input';
import { User } from '../users/entity/users.entity';

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectRepository(ChecklistTemplate)
    private readonly templateRepository: Repository<ChecklistTemplate>,
    @InjectRepository(ChecklistItem)
    private readonly itemRepository: Repository<ChecklistItem>,
    @InjectRepository(ChecklistSubmission)
    private readonly submissionRepository: Repository<ChecklistSubmission>,
  ) {}

  // ── Templates ──────────────────────────────────────────────

  async createTemplate(
    input: CreateChecklistTemplateInput,
    user: User,
  ): Promise<ChecklistTemplate> {
    const template = this.templateRepository.create({
      ...input,
      created_by: user,
    });
    return this.templateRepository.save(template);
  }

  async findAllTemplates(aircraftModel?: string): Promise<ChecklistTemplate[]> {
    const where: any = {};
    if (aircraftModel) {
      where.aircraft_model = aircraftModel;
    }
    return this.templateRepository.find({
      where,
      relations: ['items', 'created_by'],
      order: { created_at: 'DESC' },
    });
  }

  async findOneTemplate(id: number): Promise<ChecklistTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['items', 'created_by'],
    });
    if (!template) {
      throw new NotFoundException(`Checklist template with ID ${id} not found`);
    }
    return template;
  }

  async updateTemplate(
    input: UpdateChecklistTemplateInput,
  ): Promise<ChecklistTemplate> {
    const template = await this.findOneTemplate(input.id);
    Object.assign(template, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.aircraft_model !== undefined && { aircraft_model: input.aircraft_model }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    });
    return this.templateRepository.save(template);
  }

  async deactivateTemplate(id: number): Promise<ChecklistTemplate> {
    const template = await this.findOneTemplate(id);
    template.is_active = false;
    return this.templateRepository.save(template);
  }

  // ── Items ──────────────────────────────────────────────────

  async createItem(input: CreateChecklistItemInput): Promise<ChecklistItem> {
    const template = await this.findOneTemplate(input.templateId);
    const item = this.itemRepository.create({
      ...input,
      template,
    });
    return this.itemRepository.save(item);
  }

  async updateItem(input: UpdateChecklistItemInput): Promise<ChecklistItem> {
    const item = await this.itemRepository.findOne({
      where: { id: input.id },
      relations: ['template'],
    });
    if (!item) {
      throw new NotFoundException(`Checklist item with ID ${input.id} not found`);
    }
    Object.assign(item, {
      ...(input.item_name !== undefined && { item_name: input.item_name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.is_required !== undefined && { is_required: input.is_required }),
      ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
      ...(input.category !== undefined && { category: input.category }),
    });
    return this.itemRepository.save(item);
  }

  async deleteItem(id: number): Promise<boolean> {
    const item = await this.itemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Checklist item with ID ${id} not found`);
    }
    await this.itemRepository.remove(item);
    return true;
  }

  async reorderItems(templateId: number, itemIds: number[]): Promise<ChecklistItem[]> {
    const template = await this.findOneTemplate(templateId);
    const items = await this.itemRepository.find({
      where: { template: { id: templateId } },
    });

    for (let i = 0; i < itemIds.length; i++) {
      const item = items.find((it) => it.id === itemIds[i]);
      if (item) {
        item.sort_order = i;
      }
    }

    return this.itemRepository.save(items);
  }

  // ── Submissions ────────────────────────────────────────────

  async startSubmission(
    input: SubmitChecklistInput,
    pilot: User,
  ): Promise<ChecklistSubmission> {
    const template = await this.findOneTemplate(input.templateId);
    const submission = this.submissionRepository.create({
      template,
      pilot,
      responses: input.responses,
      status: ChecklistSubmissionStatus.IN_PROGRESS,
      ...(input.reservationId && {
        reservation: { id: input.reservationId } as any,
      }),
    });
    const saved = await this.submissionRepository.save(submission);
    return this.findOneSubmission(saved.id);
  }

  async updateSubmission(
    input: UpdateChecklistSubmissionInput,
  ): Promise<ChecklistSubmission> {
    const submission = await this.submissionRepository.findOne({
      where: { id: input.id },
      relations: ['template', 'template.items', 'pilot', 'reservation'],
    });
    if (!submission) {
      throw new NotFoundException(
        `Checklist submission with ID ${input.id} not found`,
      );
    }

    submission.responses = input.responses;

    if (input.completed) {
      submission.status = ChecklistSubmissionStatus.COMPLETED;
      submission.completed_at = new Date();
    }

    return this.submissionRepository.save(submission);
  }

  async completeSubmission(id: number): Promise<ChecklistSubmission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['template', 'template.items', 'pilot', 'reservation'],
    });
    if (!submission) {
      throw new NotFoundException(
        `Checklist submission with ID ${id} not found`,
      );
    }
    submission.status = ChecklistSubmissionStatus.COMPLETED;
    submission.completed_at = new Date();
    return this.submissionRepository.save(submission);
  }

  async findSubmissionsByPilot(
    pilotId: number,
    status?: ChecklistSubmissionStatus,
  ): Promise<ChecklistSubmission[]> {
    const where: any = { pilot: { id: pilotId } };
    if (status) {
      where.status = status;
    }
    return this.submissionRepository.find({
      where,
      relations: ['template', 'template.items', 'pilot', 'reservation'],
      order: { created_at: 'DESC' },
    });
  }

  async findSubmissionsByReservation(
    reservationId: number,
  ): Promise<ChecklistSubmission[]> {
    return this.submissionRepository.find({
      where: { reservation: { id: reservationId } },
      relations: ['template', 'template.items', 'pilot', 'reservation'],
      order: { created_at: 'DESC' },
    });
  }

  async findOneSubmission(id: number): Promise<ChecklistSubmission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['template', 'template.items', 'pilot', 'reservation'],
    });
    if (!submission) {
      throw new NotFoundException(
        `Checklist submission with ID ${id} not found`,
      );
    }
    return submission;
  }
}
