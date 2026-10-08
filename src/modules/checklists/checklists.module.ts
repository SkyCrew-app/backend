import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistsService } from './checklists.service';
import { ChecklistsResolver } from './checklists.resolver';
import { ChecklistTemplate } from './entity/checklist-template.entity';
import { ChecklistItem } from './entity/checklist-item.entity';
import { ChecklistSubmission } from './entity/checklist-submission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChecklistTemplate,
      ChecklistItem,
      ChecklistSubmission,
    ]),
  ],
  providers: [ChecklistsService, ChecklistsResolver],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
