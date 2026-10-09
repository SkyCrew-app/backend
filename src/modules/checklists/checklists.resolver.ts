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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  assertSelfOrRole,
  hasRole,
  isAdmin,
  ROLE_INSTRUCTOR,
  ROLE_TECHNICIAN,
} from '../../common/auth/access';

@Resolver()
export class ChecklistsResolver {
  constructor(private readonly checklistsService: ChecklistsService) {}

  // Only the pilot who started a submission, or an administrator, fills
  // it in and completes it.
  private async assertPilot(
    user: User | undefined,
    submissionId: number,
  ): Promise<void> {
    const submission =
      await this.checklistsService.findOneSubmission(submissionId);
    assertSelfOrRole(user, submission.pilot?.id);
  }

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
  async findOneSubmission(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user?: User,
  ) {
    // A submission is read by its pilot and by the staff who review it.
    const submission = await this.checklistsService.findOneSubmission(id);
    assertSelfOrRole(
      user,
      submission.pilot?.id,
      ROLE_INSTRUCTOR,
      ROLE_TECHNICIAN,
    );
    return submission;
  }

  @Query(() => [ChecklistSubmission], {
    name: 'checklistSubmissionsByReservation',
  })
  @UseGuards(JwtAuthGuard)
  async findSubmissionsByReservation(
    @Args('reservationId', { type: () => Int }) reservationId: number,
    @CurrentUser() user?: User,
  ) {
    const submissions =
      await this.checklistsService.findSubmissionsByReservation(reservationId);

    if (isAdmin(user) || hasRole(user, ROLE_INSTRUCTOR, ROLE_TECHNICIAN)) {
      return submissions;
    }

    // A member only sees their own submissions for a reservation.
    return submissions.filter(
      (submission) => Number(submission.pilot?.id) === Number(user?.id),
    );
  }

  // ── Template Mutations ─────────────────────────────────────

  @Mutation(() => ChecklistTemplate)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Instructeur', 'Technicien')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Instructeur', 'Technicien')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Instructeur', 'Technicien')
  createChecklistItem(
    @Args('createChecklistItemInput', {
      type: () => CreateChecklistItemInput,
    })
    input: CreateChecklistItemInput,
  ) {
    return this.checklistsService.createItem(input);
  }

  @Mutation(() => ChecklistItem)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Instructeur', 'Technicien')
  updateChecklistItem(
    @Args('updateChecklistItemInput', {
      type: () => UpdateChecklistItemInput,
    })
    input: UpdateChecklistItemInput,
  ) {
    return this.checklistsService.updateItem(input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Instructeur', 'Technicien')
  deleteChecklistItem(@Args('id', { type: () => Int }) id: number) {
    return this.checklistsService.deleteItem(id);
  }

  @Mutation(() => [ChecklistItem])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Instructeur', 'Technicien')
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
  async updateChecklistSubmission(
    @Args('updateChecklistSubmissionInput', {
      type: () => UpdateChecklistSubmissionInput,
    })
    input: UpdateChecklistSubmissionInput,
    @CurrentUser() user?: User,
  ) {
    await this.assertPilot(user, input.id);
    return this.checklistsService.updateSubmission(input);
  }

  @Mutation(() => ChecklistSubmission)
  @UseGuards(JwtAuthGuard)
  async completeChecklistSubmission(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user?: User,
  ) {
    await this.assertPilot(user, id);
    return this.checklistsService.completeSubmission(id);
  }
}
