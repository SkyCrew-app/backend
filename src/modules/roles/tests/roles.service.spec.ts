/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesService } from '../roles.service';
import { Role } from '../entity/roles.entity';
import { CreateRoleInput } from '../dto/create-role.input';
import { UpdateRoleInput } from '../dto/update-role.input';
import { NotFoundException } from '@nestjs/common';

describe('RolesService', () => {
  let service: RolesService;
  let repository: Repository<Role>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    repository = module.get<Repository<Role>>(getRepositoryToken(Role));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRole', () => {
    it('should create and save a role', async () => {
      const createRoleInput: CreateRoleInput = {
        role_name: 'Test Role',
      };

      const expectedRole = { id: 1, role_name: 'Test Role', users: [] };

      mockRepository.create.mockReturnValue(expectedRole);
      mockRepository.save.mockResolvedValue(expectedRole);

      const result = await service.createRole(createRoleInput);

      expect(mockRepository.create).toHaveBeenCalledWith(createRoleInput);
      expect(mockRepository.save).toHaveBeenCalledWith(expectedRole);
      expect(result).toEqual(expectedRole);
    });
  });

  describe('findAll', () => {
    it('should return all roles', async () => {
      const expectedRoles = [
        { id: 1, role_name: 'Admin', users: [] },
        { id: 2, role_name: 'User', users: [] },
      ];

      mockRepository.find.mockResolvedValue(expectedRoles);

      const result = await service.findAll();

      expect(mockRepository.find).toHaveBeenCalled();
      expect(result).toEqual(expectedRoles);
    });

    it('should return empty array when no roles exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a role by id', async () => {
      const id = 1;
      const expectedRole = { id: 1, role_name: 'Admin', users: [] };

      mockRepository.findOne.mockResolvedValue(expectedRole);

      const result = await service.findOne(id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(expectedRole);
    });

    it('should throw NotFoundException when role not found', async () => {
      const id = 999;
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(id)).rejects.toThrow(
        new NotFoundException(`Role with ID ${id} not found`),
      );
    });
  });

  describe('updateRole', () => {
    it('should update and return the role', async () => {
      const updateRoleInput: UpdateRoleInput = {
        id: 1,
        role_name: 'Updated Role',
      };

      const existingRole = { id: 1, role_name: 'Old Role', users: [] };
      const updatedRole = { id: 1, role_name: 'Updated Role', users: [] };

      jest.spyOn(service, 'findOne').mockResolvedValue(existingRole);
      mockRepository.save.mockResolvedValue(updatedRole);

      const result = await service.updateRole(updateRoleInput);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...existingRole,
        ...updateRoleInput,
      });
      expect(result).toEqual(updatedRole);
    });

    it('should throw NotFoundException when role to update not found', async () => {
      const updateRoleInput: UpdateRoleInput = {
        id: 999,
        role_name: 'Updated Role',
      };

      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new NotFoundException(`Role with ID 999 not found`));

      await expect(service.updateRole(updateRoleInput)).rejects.toThrow(
        new NotFoundException(`Role with ID 999 not found`),
      );
    });
  });

  describe('deleteRole', () => {
    it('should delete role and return true when successful', async () => {
      const id = 1;
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteRole(id);

      expect(mockRepository.delete).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when role to delete not found', async () => {
      const id = 999;
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteRole(id)).rejects.toThrow(
        new NotFoundException(`Role with ID ${id} not found`),
      );
    });
  });
});
