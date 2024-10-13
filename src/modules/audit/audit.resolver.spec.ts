import { Test, TestingModule } from '@nestjs/testing';
import { AuditResolver } from './audit.resolver';

describe('AuditResolver', () => {
  let resolver: AuditResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditResolver],
    }).compile();

    resolver = module.get<AuditResolver>(AuditResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
