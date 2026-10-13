import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChecklistsService } from '../checklists.service';
import { ChecklistTemplate } from '../entity/checklist-template.entity';
import { ChecklistItem } from '../entity/checklist-item.entity';
import { ChecklistSubmission } from '../entity/checklist-submission.entity';

describe('ChecklistsService template removal', () => {
  let service: ChecklistsService;
  let templates: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let submissions: { count: jest.Mock };

  beforeEach(async () => {
    templates = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 4, name: 'Prévol DR400', is_active: true }),
      save: jest.fn(),
      delete: jest.fn(),
    };
    submissions = { count: jest.fn().mockResolvedValue(0) };

    const module = await Test.createTestingModule({
      providers: [
        ChecklistsService,
        { provide: getRepositoryToken(ChecklistTemplate), useValue: templates },
        { provide: getRepositoryToken(ChecklistItem), useValue: {} },
        {
          provide: getRepositoryToken(ChecklistSubmission),
          useValue: submissions,
        },
      ],
    }).compile();

    service = module.get(ChecklistsService);
  });

  it('deletes a template nobody filled in', async () => {
    const removal = await service.removeTemplate(4);

    expect(submissions.count).toHaveBeenCalledWith({
      where: { template: { id: 4 } },
    });
    expect(templates.delete).toHaveBeenCalledWith(4);
    expect(removal).toEqual({
      deleted: true,
      deactivated: false,
      submissions_count: 0,
      message: 'Le modèle « Prévol DR400 » a été supprimé.',
    });
  });

  it('keeps and deactivates a template that filled-in checklists refer to', async () => {
    submissions.count.mockResolvedValue(3);

    const removal = await service.removeTemplate(4);

    expect(templates.delete).not.toHaveBeenCalled();
    expect(templates.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, is_active: false }),
    );
    expect(removal.deleted).toBe(false);
    expect(removal.deactivated).toBe(true);
    expect(removal.submissions_count).toBe(3);
    expect(removal.message).toContain('désactivé');
  });

  it('answers not found for an unknown template', async () => {
    templates.findOne.mockResolvedValue(null);

    await expect(service.removeTemplate(99)).rejects.toThrow(NotFoundException);
    expect(templates.delete).not.toHaveBeenCalled();
  });

  it('writes the message in the language of the request', async () => {
    await expect(service.removeTemplate(4, 'en')).resolves.toEqual(
      expect.objectContaining({
        deleted: true,
        message: 'The template "Prévol DR400" has been deleted.',
      }),
    );

    submissions.count.mockResolvedValue(3);
    const kept = await service.removeTemplate(4, 'en');

    expect(kept.message).toBe(
      'The template "Prévol DR400" is used by 3 completed checklist(s): it has been deactivated instead of deleted, to keep the history.',
    );
    await expect(service.removeTemplate(4)).resolves.toEqual(
      expect.objectContaining({
        message:
          "Le modèle « Prévol DR400 » est utilisé par 3 checklist(s) déjà remplie(s) : il a été désactivé au lieu d'être supprimé, afin de conserver l'historique.",
      }),
    );
  });
});
