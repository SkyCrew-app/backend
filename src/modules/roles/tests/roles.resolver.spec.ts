/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { RolesResolver } from '../roles.resolver';
import { RolesService } from '../roles.service';
import { CreateRoleInput } from '../dto/create-role.input';
import { UpdateRoleInput } from '../dto/update-role.input';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

describe('RolesResolver', () => {
  let resolver: RolesResolver;
  let service: RolesService;

  const mockService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesResolver,
        {
          provide: RolesService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<RolesResolver>(RolesResolver);
    service = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all roles', async () => {
      const expectedRoles = [
        { id: 1, role_name: 'Admin', users: [] },
        { id: 2, role_name: 'User', users: [] },
      ];

      mockService.findAll.mockResolvedValue(expectedRoles);

      const result = await resolver.findAll();

      expect(mockService.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedRoles);
    });
  });

  describe('findOne', () => {
    it('should return a role by id', async () => {
      const id = 1;
      const expectedRole = { id: 1, role_name: 'Admin', users: [] };

      mockService.findOne.mockResolvedValue(expectedRole);

      const result = await resolver.findOne(id);

      expect(mockService.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(expectedRole);
    });
  });

  describe('createRole', () => {
    it('should create a role', async () => {
      const createRoleInput: CreateRoleInput = {
        role_name: 'Test Role',
      };

      const expectedRole = { id: 1, role_name: 'Test Role', users: [] };

      mockService.createRole.mockResolvedValue(expectedRole);

      const result = await resolver.createRole(createRoleInput);

      expect(mockService.createRole).toHaveBeenCalledWith(createRoleInput);
      expect(result).toEqual(expectedRole);
    });
  });

  describe('updateRole', () => {
    it('should update a role', async () => {
      const updateRoleInput: UpdateRoleInput = {
        id: 1,
        role_name: 'Updated Role',
      };

      const expectedRole = { id: 1, role_name: 'Updated Role', users: [] };

      mockService.updateRole.mockResolvedValue(expectedRole);

      const result = await resolver.updateRole(updateRoleInput);

      expect(mockService.updateRole).toHaveBeenCalledWith(updateRoleInput);
      expect(result).toEqual(expectedRole);
    });
  });

  describe('deleteRole', () => {
    it('should delete a role and return true', async () => {
      const id = 1;
      mockService.deleteRole.mockResolvedValue(true);

      const result = await resolver.deleteRole(id);

      expect(mockService.deleteRole).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      const id = 1;
      mockService.deleteRole.mockResolvedValue(false);

      const result = await resolver.deleteRole(id);

      expect(mockService.deleteRole).toHaveBeenCalledWith(id);
      expect(result).toBe(false);
    });
  });
});
