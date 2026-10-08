import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
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
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entity/users.entity';

@Resolver()
export class ChecklistsResolver {
  constructor(private readonly checklistsService: ChecklistsService) {}

  // ── Template Queries ───────────────────────────────────────

  @Query(() => [ChecklistTemplate], { name: 'checklistTemplates' })
  @UseGuards(JwtAuthGuard)
  findAllTemplates(
    @Args('aircraftModel', { type: () => String, nullable: true })
    aircraftModel?: string,
  ) {
    return this.checklistsService.findAllTemplates(aircraftModel);
  }

  @Query(() => ChecklistTemplate, { name: 'checklistTemplate' })
  @UseGuards(JwtAuthGuard)
  findOneTemplate(@Args('id', { type: () => Int }) id: number) {
    return this.checklistsService.findOneTemplate(id);
  }

  // ── Submission Queries ─────────────────────────────────────

  @Query(() => [ChecklistSubmission], { name: 'checklistSubmissions' })
  @UseGuards(JwtAuthGuard)
  findSubmissions(
    @CurrentUser() user: User,
    @Args('status', { type: () => ChecklistSubmissionStatus, nullable: true })
    status?: ChecklistSubmissionStatus,
  ) {
    return this.checklistsService.findSubmissionsByPilot(user.id, status);
  }

  @Query(() => ChecklistSubmission, { name: 'checklistSubmission' })
  @UseGuards(JwtAuthGuard)
  findOneSubmission(@Args('id', { type: () => Int }) id: number) {
    return this.checklistsService.findOneSubmission(id);
  }

  @Query(() => [ChecklistSubmission], {
    name: 'checklistSubmissionsByReservation',
  })
  @UseGuards(JwtAuthGuard)
  findSubmissionsByReservation(
    @Args('reservationId', { type: () => Int }) reservationId: number,
  ) {
    return this.checklistsService.findSubmissionsByReservation(reservationId);
  }

  // ── Template Mutations ─────────────────────────────────────

  @Mutation(() => ChecklistTemplate)
  @UseGuards(JwtAuthGuard)
  createChecklistTemplate(
    @Args('createChecklistTemplateInput', {
      type: () => CreateChecklistTemplateInput,
    })
    input: CreateChecklistTemplateInput,
    @CurrentUser() user: User,
  ) {
    return this.checklistsService.createTemplate(input, user);
  }

  @Mutation(() => ChecklistTemplate)
  @UseGuards(JwtAuthGuard)
  updateChecklistTemplate(
    @Args('updateChecklistTemplateInput', {
      type: () => UpdateChecklistTemplateInput,
    })
    input: UpdateChecklistTemplateInput,
  ) {
    return this.checklistsService.updateTemplate(input);
  }

  // ── Item Mutations ─────────────────────────────────────────

  @Mutation(() => ChecklistItem)
  @UseGuards(JwtAuthGuard)
  createChecklistItem(
    @Args('createChecklistItemInput', {
      type: () => CreateChecklistItemInput,
    })
    input: CreateChecklistItemInput,
  ) {
    return this.checklistsService.createItem(input);
  }

  @Mutation(() => ChecklistItem)
  @UseGuards(JwtAuthGuard)
  updateChecklistItem(
    @Args('updateChecklistItemInput', {
      type: () => UpdateChecklistItemInput,
    })
    input: UpdateChecklistItemInput,
  ) {
    return this.checklistsService.updateItem(input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  deleteChecklistItem(@Args('id', { type: () => Int }) id: number) {
    return this.checklistsService.deleteItem(id);
  }

  @Mutation(() => [ChecklistItem])
  @UseGuards(JwtAuthGuard)
  reorderChecklistItems(
    @Args('templateId', { type: () => Int }) templateId: number,
    @Args('itemIds', { type: () => [Int] }) itemIds: number[],
  ) {
    return this.checklistsService.reorderItems(templateId, itemIds);
  }

  // ── Submission Mutations ───────────────────────────────────

  @Mutation(() => ChecklistSubmission)
  @UseGuards(JwtAuthGuard)
  startChecklistSubmission(
    @Args('submitChecklistInput', { type: () => SubmitChecklistInput })
    input: SubmitChecklistInput,
    @CurrentUser() user: User,
  ) {
    return this.checklistsService.startSubmission(input, user);
  }

  @Mutation(() => ChecklistSubmission)
  @UseGuards(JwtAuthGuard)
  updateChecklistSubmission(
    @Args('updateChecklistSubmissionInput', {
      type: () => UpdateChecklistSubmissionInput,
    })
    input: UpdateChecklistSubmissionInput,
  ) {
    return this.checklistsService.updateSubmission(input);
  }

  @Mutation(() => ChecklistSubmission)
  @UseGuards(JwtAuthGuard)
  completeChecklistSubmission(@Args('id', { type: () => Int }) id: number) {
    return this.checklistsService.completeSubmission(id);
  }
}
