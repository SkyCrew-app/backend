import { Test, TestingModule } from '@nestjs/testing';
import { InstructionCoursesResolver } from './instruction-courses.resolver';

describe('InstructionCoursesResolver', () => {
  let resolver: InstructionCoursesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InstructionCoursesResolver],
    }).compile();

    resolver = module.get<InstructionCoursesResolver>(InstructionCoursesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
