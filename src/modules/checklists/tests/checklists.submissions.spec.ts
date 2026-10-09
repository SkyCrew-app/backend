import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChecklistsService } from '../checklists.service';
import { ChecklistTemplate } from '../entity/checklist-template.entity';
import { ChecklistItem } from '../entity/checklist-item.entity';
import {
  ChecklistSubmission,
  ChecklistSubmissionStatus,
} from '../entity/checklist-submission.entity';

describe('ChecklistsService submissions', () => {
  let service: ChecklistsService;
  let submissions: { update: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    submissions = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 9 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ChecklistsService,
        { provide: getRepositoryToken(ChecklistTemplate), useValue: {} },
        { provide: getRepositoryToken(ChecklistItem), useValue: {} },
        {
          provide: getRepositoryToken(ChecklistSubmission),
          useValue: submissions,
        },
      ],
    }).compile();

    service = module.get(ChecklistsService);
  });

  const responses = [{ itemId: 1, checked: true }] as any;

  it('saves the answers without touching the status', async () => {
    await expect(
      service.updateSubmission({ id: 9, responses } as any),
    ).resolves.toEqual({ id: 9 });

    // A save that arrives after the completion must not reopen the checklist.
    expect(submissions.update).toHaveBeenCalledWith(9, { responses });
  });

  it('completes without rewriting the answers', async () => {
    await service.completeSubmission(9);

    expect(submissions.update).toHaveBeenCalledWith(9, {
      status: ChecklistSubmissionStatus.COMPLETED,
      completed_at: expect.any(Date),
    });
  });

  it('can save and complete in one call', async () => {
    await service.updateSubmission({
      id: 9,
      responses,
      completed: true,
    } as any);

    expect(submissions.update).toHaveBeenCalledWith(9, {
      responses,
      status: ChecklistSubmissionStatus.COMPLETED,
      completed_at: expect.any(Date),
    });
  });

  it.each([
    ['saving', () => service.updateSubmission({ id: 404, responses } as any)],
    ['completing', () => service.completeSubmission(404)],
  ])('reports an unknown checklist when %s', async (_label, call) => {
    submissions.update.mockResolvedValue({ affected: 0 });

    await expect(call()).rejects.toThrow(NotFoundException);
  });
});
