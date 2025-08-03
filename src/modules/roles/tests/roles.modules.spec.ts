import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RolesModule } from '../roles.module';
import { RolesService } from '../roles.service';
import { RolesResolver } from '../roles.resolver';
import { Role } from '../entity/roles.entity';

describe('RolesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RolesModule],
    })
      .overrideProvider(getRepositoryToken(Role))
      .useValue({})
      .compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide RolesService', () => {
    const service = module.get<RolesService>(RolesService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(RolesService);
  });

  it('should provide RolesResolver', () => {
    const resolver = module.get<RolesResolver>(RolesResolver);
    expect(resolver).toBeDefined();
    expect(resolver).toBeInstanceOf(RolesResolver);
  });
});
