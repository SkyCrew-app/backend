import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChecklistsService } from '../checklists.service';
import { ChecklistTemplate } from '../entity/checklist-template.entity';
import { ChecklistItem } from '../entity/checklist-item.entity';
import {
  ChecklistSubmission,
  ChecklistSubmissionStatus,
} from '../entity/checklist-submission.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';

describe('ChecklistsService submissions', () => {
  let service: ChecklistsService;
  let submissions: {
    update: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let templates: { findOne: jest.Mock };
  let reservations: { findOne: jest.Mock };

  // Item 1 is required, item 2 is not.
  const template = {
    id: 2,
    is_active: true,
    items: [
      { id: 1, is_required: true },
      { id: 2, is_required: false },
    ],
  };
  const inProgress = { id: 9 };

  beforeEach(async () => {
    submissions = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 9, template, responses: [] }),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 9, ...value })),
    };
    templates = { findOne: jest.fn().mockResolvedValue(template) };
    reservations = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ChecklistsService,
        { provide: getRepositoryToken(ChecklistTemplate), useValue: templates },
        { provide: getRepositoryToken(ChecklistItem), useValue: {} },
        {
          provide: getRepositoryToken(ChecklistSubmission),
          useValue: submissions,
        },
        { provide: getRepositoryToken(Reservation), useValue: reservations },
      ],
    }).compile();

    service = module.get(ChecklistsService);
  });

  const responses = [{ itemId: 1, checked: true }] as any;

  it('saves the answers without touching the status', async () => {
    await expect(
      service.updateSubmission({ id: 9, responses } as any),
    ).resolves.toMatchObject(inProgress);

    // Only a checklist still in progress is written.
    expect(submissions.update).toHaveBeenCalledWith(
      { id: 9, status: ChecklistSubmissionStatus.IN_PROGRESS },
      { responses },
    );
  });

  it('completes without rewriting the answers', async () => {
    submissions.findOne.mockResolvedValue({ id: 9, template, responses });

    await service.completeSubmission(9);

    expect(submissions.update).toHaveBeenCalledWith(
      { id: 9, status: ChecklistSubmissionStatus.IN_PROGRESS },
      {
        status: ChecklistSubmissionStatus.COMPLETED,
        completed_at: expect.any(Date),
      },
    );
  });

  it('can save and complete in one call', async () => {
    await service.updateSubmission({
      id: 9,
      responses,
      completed: true,
    } as any);

    expect(submissions.update).toHaveBeenCalledWith(
      { id: 9, status: ChecklistSubmissionStatus.IN_PROGRESS },
      {
        responses,
        status: ChecklistSubmissionStatus.COMPLETED,
        completed_at: expect.any(Date),
      },
    );
  });

  it.each([
    ['saving', () => service.updateSubmission({ id: 404, responses } as any)],
    ['completing', () => service.completeSubmission(404)],
  ])('reports an unknown checklist when %s', async (_label, call) => {
    submissions.update.mockResolvedValue({ affected: 0 });
    submissions.findOne.mockResolvedValue(null);

    await expect(call()).rejects.toThrow(NotFoundException);
  });

  // The first version of this file asserted that a save arriving after the
  // completion still rewrote the answers.
  it.each([
    [
      'its answers',
      () => service.updateSubmission({ id: 9, responses } as any),
    ],
    ['its completion', () => service.completeSubmission(9)],
  ])(
    'refuses to rewrite %s once the checklist is completed',
    async (_label, call) => {
      submissions.findOne.mockResolvedValue({
        id: 9,
        template,
        responses,
        status: ChecklistSubmissionStatus.COMPLETED,
      });
      // No row is in progress any more.
      submissions.update.mockResolvedValue({ affected: 0 });

      await expect(call()).rejects.toThrow(ConflictException);
    },
  );

  it.each([
    ['completing', () => service.completeSubmission(9)],
    [
      'saving and completing',
      () =>
        service.updateSubmission({
          id: 9,
          responses: [
            { itemId: 1, checked: false },
            { itemId: 2, checked: true },
          ],
          completed: true,
        } as any),
    ],
  ])(
    'refuses %s while a required item is not checked',
    async (_label, call) => {
      await expect(call()).rejects.toThrow(
        'Il reste 1 point(s) obligatoire(s) à vérifier',
      );
      expect(submissions.update).not.toHaveBeenCalled();
    },
  );

  describe('starting a checklist', () => {
    const pilot = { id: 3 } as any;
    const input = { templateId: 2, reservationId: 40, responses: [] } as any;

    it('attaches it to a booking of the pilot', async () => {
      reservations.findOne.mockResolvedValue({ id: 40, user: { id: 3 } });

      await service.startSubmission(input, pilot);

      expect(submissions.save).toHaveBeenCalledWith(
        expect.objectContaining({ pilot, reservation: { id: 40 } }),
      );
    });

    it('refuses the booking of another member, whoever asks', async () => {
      reservations.findOne.mockResolvedValue({ id: 40, user: { id: 8 } });

      await expect(service.startSubmission(input, pilot)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.startSubmission(input, {
          id: 1,
          role: { role_name: 'Administrateur' },
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(submissions.save).not.toHaveBeenCalled();
    });

    it('refuses an unknown or cancelled booking', async () => {
      reservations.findOne.mockResolvedValue(null);
      await expect(service.startSubmission(input, pilot)).rejects.toThrow(
        NotFoundException,
      );

      reservations.findOne.mockResolvedValue({
        id: 40,
        user: { id: 3 },
        status: 'cancelled',
      });
      await expect(service.startSubmission(input, pilot)).rejects.toThrow(
        ConflictException,
      );
      expect(submissions.save).not.toHaveBeenCalled();
    });

    it('refuses a template taken out of use', async () => {
      templates.findOne.mockResolvedValue({ ...template, is_active: false });

      await expect(
        service.startSubmission({ templateId: 2, responses: [] } as any, pilot),
      ).rejects.toThrow(ConflictException);
    });

    it('still starts a checklist that is not tied to a booking', async () => {
      await service.startSubmission(
        { templateId: 2, responses: [] } as any,
        pilot,
      );

      expect(reservations.findOne).not.toHaveBeenCalled();
      expect(submissions.save).toHaveBeenCalled();
    });
  });
});
