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
    manager: { getRepository: jest.fn() },
  };
  const membersHolding = jest.fn();

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

  beforeEach(() => {
    mockRepository.find.mockResolvedValue([]);
    membersHolding.mockResolvedValue(0);
    mockRepository.manager.getRepository.mockReturnValue({
      count: membersHolding,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
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

    it('refuses an empty name', async () => {
      await expect(service.createRole({ role_name: '   ' })).rejects.toThrow(
        'Le nom du rôle est requis',
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('refuses a name already carried by a role, whatever the case', async () => {
      mockRepository.find.mockResolvedValue([{ id: 1, role_name: 'Pilote' }]);

      await expect(
        service.createRole({ role_name: ' pilote ' }),
      ).rejects.toThrow('Un rôle porte déjà ce nom');
      expect(mockRepository.save).not.toHaveBeenCalled();
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

    it.each(['Administrateur', 'Pilote', 'Instructeur', 'Technicien'])(
      'refuses to rename the built-in role %s',
      async (name) => {
        const role = { id: 1, role_name: name, users: [] };
        jest.spyOn(service, 'findOne').mockResolvedValue(role);

        await expect(
          service.updateRole({ id: 1, role_name: 'Chef' }),
        ).rejects.toThrow(`Le rôle « ${name} » est nécessaire`);
        expect(role.role_name).toBe(name);
        expect(mockRepository.save).not.toHaveBeenCalled();
      },
    );

    it('refuses to give a role the name of another one', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue({ id: 5, role_name: 'Bénévole', users: [] });
      mockRepository.find.mockResolvedValue([
        { id: 5, role_name: 'Bénévole' },
        { id: 6, role_name: 'Trésorier' },
      ]);

      await expect(
        service.updateRole({ id: 5, role_name: 'trésorier' }),
      ).rejects.toThrow('Un rôle porte déjà ce nom');
      expect(mockRepository.save).not.toHaveBeenCalled();
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
      mockRepository.findOne.mockResolvedValue({
        id: 9,
        role_name: 'Bénévole',
      });

      const result = await service.deleteRole(9);

      expect(mockRepository.delete).toHaveBeenCalledWith(9);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when role to delete not found', async () => {
      const id = 999;
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteRole(id)).rejects.toThrow(
        new NotFoundException(`Role with ID ${id} not found`),
      );
    });

    it.each(['Administrateur', 'Pilote', 'Instructeur', 'Technicien'])(
      'refuses to delete the built-in role %s',
      async (name) => {
        mockRepository.findOne.mockResolvedValue({ id: 1, role_name: name });

        await expect(service.deleteRole(1)).rejects.toThrow(
          'il ne peut être ni renommé ni supprimé',
        );
        expect(mockRepository.delete).not.toHaveBeenCalled();
      },
    );

    it('refuses to delete a role some members hold', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 9,
        role_name: 'Bénévole',
      });
      membersHolding.mockResolvedValue(3);

      await expect(service.deleteRole(9)).rejects.toThrow(
        'Ce rôle est attribué à 3 membre(s)',
      );
      expect(membersHolding).toHaveBeenCalledWith({
        where: { role: { id: 9 } },
      });
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });
});
