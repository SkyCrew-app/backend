import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationResolver } from './administration.resolver';
import { UsersService } from '../users/users.service';
import { AdministrationService } from './administration.service';
import { JwtService } from '@nestjs/jwt';

describe('AdministrationResolver', () => {
  let resolver: AdministrationResolver;

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrationResolver,
        UsersService,
        AdministrationService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    resolver = module.get<AdministrationResolver>(AdministrationResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
