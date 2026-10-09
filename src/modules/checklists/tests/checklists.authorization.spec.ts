import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ChecklistsResolver } from '../checklists.resolver';
import { ChecklistsService } from '../checklists.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

const admin = { id: 1, role: { role_name: 'Administrateur' } } as any;
const instructor = { id: 4, role: { role_name: 'Instructeur' } } as any;
const pilot = { id: 3, role: { role_name: 'Pilote' } } as any;
const otherPilot = { id: 7, role: { role_name: 'Pilote' } } as any;

// Submission 20 was started by the pilot (3).
const submission = { id: 20, pilot: { id: 3 } } as any;

describe('Checklists authorization', () => {
  let resolver: ChecklistsResolver;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findOneSubmission: jest.fn().mockResolvedValue(submission),
      findSubmissionsByReservation: jest
        .fn()
        .mockResolvedValue([submission, { id: 21, pilot: { id: 7 } }]),
      updateSubmission: jest.fn().mockResolvedValue(submission),
      completeSubmission: jest.fn().mockResolvedValue(submission),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistsResolver,
        { provide: ChecklistsService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get(ChecklistsResolver);
  });

  describe('templates and items', () => {
    const reflector = new Reflector();

    it.each([
      'createChecklistTemplate',
      'updateChecklistTemplate',
      'createChecklistItem',
      'updateChecklistItem',
      'deleteChecklistItem',
      'reorderChecklistItems',
    ])('%s is reserved to staff roles', (method) => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        ChecklistsResolver.prototype[method],
      );

      expect(roles).toEqual(['Administrateur', 'Instructeur', 'Technicien']);
    });
  });

  describe('submissions', () => {
    it('lets the pilot fill in and complete their submission', async () => {
      await expect(
        resolver.updateChecklistSubmission({ id: 20 } as any, pilot),
      ).resolves.toBe(submission);
      await expect(
        resolver.completeChecklistSubmission(20, pilot),
      ).resolves.toBe(submission);
    });

    it.each([
      ['another pilot', otherPilot],
      ['an instructor', instructor],
    ])('refuses %s changing the submission', async (_label, caller) => {
      await expect(
        resolver.updateChecklistSubmission({ id: 20 } as any, caller),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        resolver.completeChecklistSubmission(20, caller),
      ).rejects.toThrow(ForbiddenException);
      expect(service.updateSubmission).not.toHaveBeenCalled();
      expect(service.completeSubmission).not.toHaveBeenCalled();
    });

    it('lets the pilot and the reviewing staff read a submission', async () => {
      await expect(resolver.findOneSubmission(20, pilot)).resolves.toBe(
        submission,
      );
      await expect(resolver.findOneSubmission(20, instructor)).resolves.toBe(
        submission,
      );
      await expect(resolver.findOneSubmission(20, admin)).resolves.toBe(
        submission,
      );
    });

    it('refuses another pilot reading a submission', async () => {
      await expect(resolver.findOneSubmission(20, otherPilot)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('shows a member only their own submissions for a reservation', async () => {
      await expect(
        resolver.findSubmissionsByReservation(5, pilot),
      ).resolves.toEqual([submission]);
      await expect(
        resolver.findSubmissionsByReservation(5, instructor),
      ).resolves.toHaveLength(2);
    });
  });
});
