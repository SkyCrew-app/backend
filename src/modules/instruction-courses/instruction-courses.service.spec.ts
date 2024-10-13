import { Test, TestingModule } from '@nestjs/testing';
import { InstructionCoursesService } from './instruction-courses.service';

describe('InstructionCoursesService', () => {
  let service: InstructionCoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InstructionCoursesService],
    }).compile();

    service = module.get<InstructionCoursesService>(InstructionCoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
