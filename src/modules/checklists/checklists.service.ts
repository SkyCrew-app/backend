import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { ChecklistTemplateRemoval } from './dto/checklist-template-removal.type';
import { DEFAULT_LANGUAGE, Language } from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectRepository(ChecklistTemplate)
    private readonly templateRepository: Repository<ChecklistTemplate>,
    @InjectRepository(ChecklistItem)
    private readonly itemRepository: Repository<ChecklistItem>,
    @InjectRepository(ChecklistSubmission)
    private readonly submissionRepository: Repository<ChecklistSubmission>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
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
      ...(input.aircraft_model !== undefined && {
        aircraft_model: input.aircraft_model,
      }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    });
    return this.templateRepository.save(template);
  }

  async deactivateTemplate(id: number): Promise<ChecklistTemplate> {
    const template = await this.findOneTemplate(id);
    template.is_active = false;
    return this.templateRepository.save(template);
  }

  // A template nobody filled in is deleted with its items. Once checklists
  // refer to it, it is kept for the record and only taken out of use.
  async removeTemplate(
    id: number,
    language: Language = DEFAULT_LANGUAGE,
  ): Promise<ChecklistTemplateRemoval> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Modèle de checklist introuvable');
    }

    const submissionsCount = await this.submissionRepository.count({
      where: { template: { id } },
    });

    if (submissionsCount > 0) {
      template.is_active = false;
      await this.templateRepository.save(template);
      return {
        deleted: false,
        deactivated: true,
        submissions_count: submissionsCount,
        message: translate(language, 'checklist.templateDeactivated', {
          name: template.name,
          count: submissionsCount,
        }),
      };
    }

    await this.templateRepository.delete(id);
    return {
      deleted: true,
      deactivated: false,
      submissions_count: 0,
      message: translate(language, 'checklist.templateDeleted', {
        name: template.name,
      }),
    };
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
      throw new NotFoundException(
        `Checklist item with ID ${input.id} not found`,
      );
    }
    Object.assign(item, {
      ...(input.item_name !== undefined && { item_name: input.item_name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.is_required !== undefined && {
        is_required: input.is_required,
      }),
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

  async reorderItems(
    templateId: number,
    itemIds: number[],
  ): Promise<ChecklistItem[]> {
    // Fails when the template does not exist.
    await this.findOneTemplate(templateId);
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
    if (!template.is_active) {
      throw localized(ConflictException, 'error.checklist.templateInactive');
    }

    // A pre-flight checklist is filled in by the pilot of the booking.
    if (input.reservationId) {
      const reservation = await this.reservationRepository.findOne({
        where: { id: input.reservationId },
        relations: ['user'],
      });
      if (!reservation) {
        throw new NotFoundException(
          `Reservation with ID ${input.reservationId} not found`,
        );
      }
      if (Number(reservation.user?.id) !== Number(pilot?.id)) {
        throw localized(ForbiddenException, 'error.checklist.notOwnBooking');
      }
      if (reservation.status === ReservationStatus.CANCELLED) {
        throw localized(ConflictException, 'error.checklist.bookingCancelled');
      }
    }

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

  // Saving answers and completing a checklist can reach the server at the same
  // time. Each one writes only its own columns, so neither undoes the other.
  async updateSubmission(
    input: UpdateChecklistSubmissionInput,
  ): Promise<ChecklistSubmission> {
    const changes: Partial<ChecklistSubmission> = {
      responses: input.responses,
    };
    if (input.completed) {
      await this.assertRequiredItemsChecked(input.id, input.responses);
      changes.status = ChecklistSubmissionStatus.COMPLETED;
      changes.completed_at = new Date();
    }

    return this.writeSubmission(input.id, changes);
  }

  // A checklist is complete once every required item is checked.
  private async assertRequiredItemsChecked(
    id: number,
    responses?: { itemId: number; checked: boolean }[],
  ): Promise<void> {
    const submission = await this.findOneSubmission(id);
    const checked = new Set(
      (responses ?? submission.responses ?? [])
        .filter((response) => response.checked)
        .map((response) => Number(response.itemId)),
    );
    const missing = (submission.template?.items ?? []).filter(
      (item) => item.is_required && !checked.has(Number(item.id)),
    );
    if (missing.length > 0) {
      throw localized(
        ConflictException,
        'error.checklist.requiredItemsMissing',
        {
          count: missing.length,
        },
      );
    }
  }

  async completeSubmission(id: number): Promise<ChecklistSubmission> {
    await this.assertRequiredItemsChecked(id);
    return this.writeSubmission(id, {
      status: ChecklistSubmissionStatus.COMPLETED,
      completed_at: new Date(),
    });
  }

  private async writeSubmission(
    id: number,
    changes: Partial<ChecklistSubmission>,
  ): Promise<ChecklistSubmission> {
    // A completed checklist is a record: it is written while it is in
    // progress and never afterwards.
    const result = await this.submissionRepository.update(
      { id, status: ChecklistSubmissionStatus.IN_PROGRESS },
      changes as any,
    );
    if (!result.affected) {
      // Not found, or no longer in progress.
      await this.findOneSubmission(id);
      throw localized(ConflictException, 'error.checklist.alreadyCompleted');
    }
    return this.findOneSubmission(id);
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
