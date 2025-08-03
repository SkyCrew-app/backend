import { DataSource, Repository } from 'typeorm';
import { Role } from '../../modules/roles/entity/roles.entity';
import { seedRoles } from '../roles.seeder';

describe('Roles Seeder', () => {
  let dataSource: jest.Mocked<DataSource>;
  let repository: jest.Mocked<Repository<Role>>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as any;

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
  });

  it('should create all roles when none exist', async () => {
    // Arrange
    repository.findOne.mockResolvedValue(null);
    repository.create.mockImplementation((data) => data as any);
    repository.save.mockResolvedValue({} as any);

    // Act
    await seedRoles(dataSource);

    // Assert
    expect(repository.findOne).toHaveBeenCalledTimes(4);
    expect(repository.create).toHaveBeenCalledTimes(4);
    expect(repository.save).toHaveBeenCalledTimes(4);

    expect(repository.create).toHaveBeenCalledWith({
      role_name: 'Administrateur',
    });
    expect(repository.create).toHaveBeenCalledWith({ role_name: 'Pilote' });
    expect(repository.create).toHaveBeenCalledWith({
      role_name: 'Instructeur',
    });
    expect(repository.create).toHaveBeenCalledWith({ role_name: 'Technicien' });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Administrateur" created successfully',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Pilote" created successfully',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Instructeur" created successfully',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Technicien" created successfully',
    );
    expect(consoleSpy).toHaveBeenCalledWith('Roles seeding completed');
  });

  it('should skip existing roles and create only missing ones', async () => {
    // Arrange
    repository.findOne
      .mockResolvedValueOnce({ id: 1, role_name: 'Administrateur' } as any) // Existe
      .mockResolvedValueOnce(null) // N'existe pas
      .mockResolvedValueOnce({ id: 3, role_name: 'Instructeur' } as any) // Existe
      .mockResolvedValueOnce(null); // N'existe pas

    repository.create.mockImplementation((data) => data as any);
    repository.save.mockResolvedValue({} as any);

    // Act
    await seedRoles(dataSource);

    // Assert
    expect(repository.create).toHaveBeenCalledTimes(2); // Seulement les 2 manquants
    expect(repository.save).toHaveBeenCalledTimes(2);

    expect(repository.create).toHaveBeenCalledWith({ role_name: 'Pilote' });
    expect(repository.create).toHaveBeenCalledWith({ role_name: 'Technicien' });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Administrateur" already exists',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Pilote" created successfully',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Instructeur" already exists',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Technicien" created successfully',
    );
  });

  it('should handle all roles already existing', async () => {
    // Arrange
    repository.findOne.mockResolvedValue({
      id: 1,
      role_name: 'Existing',
    } as any);

    // Act
    await seedRoles(dataSource);

    // Assert
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Administrateur" already exists',
    );
    expect(consoleSpy).toHaveBeenCalledWith('Role "Pilote" already exists');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Role "Instructeur" already exists',
    );
    expect(consoleSpy).toHaveBeenCalledWith('Role "Technicien" already exists');
    expect(consoleSpy).toHaveBeenCalledWith('Roles seeding completed');
  });

  it('should handle database errors during role creation', async () => {
    // Arrange
    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue({} as any);
    repository.save.mockRejectedValue(new Error('Save failed'));

    // Act & Assert
    await expect(seedRoles(dataSource)).rejects.toThrow('Save failed');
  });

  it('should process roles in correct order', async () => {
    // Arrange
    repository.findOne.mockResolvedValue(null);
    repository.create.mockImplementation((data) => data as any);
    repository.save.mockResolvedValue({} as any);

    // Act
    await seedRoles(dataSource);

    // Assert
    const findOneCalls = repository.findOne.mock.calls;
    expect(findOneCalls[0][0]).toEqual({
      where: { role_name: 'Administrateur' },
    });
    expect(findOneCalls[1][0]).toEqual({ where: { role_name: 'Pilote' } });
    expect(findOneCalls[2][0]).toEqual({ where: { role_name: 'Instructeur' } });
    expect(findOneCalls[3][0]).toEqual({ where: { role_name: 'Technicien' } });
  });
});
