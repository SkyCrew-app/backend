import { DataSource, Repository } from 'typeorm';
import { Administration } from '../../modules/administration/entity/admin.entity';
import { seedAdministration } from '../admin.seeder';

describe('Administration Seeder', () => {
  let dataSource: jest.Mocked<DataSource>;
  let repository: jest.Mocked<Repository<Administration>>;
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

  it('should create administration configuration when none exists', async () => {
    // Arrange
    repository.findOne.mockResolvedValue(null);
    const mockAdmin = { id: 1, clubName: 'SkyCrew Aviation Club' };
    repository.create.mockReturnValue(mockAdmin as any);
    repository.save.mockResolvedValue(mockAdmin as any);

    // Act
    await seedAdministration(dataSource);

    // Assert
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(repository.create).toHaveBeenCalledWith({
      clubName: 'SkyCrew Aviation Club',
      contactEmail: 'contact@skycrew.com',
      contactPhone: '+33123456789',
      address: '123 Airport Road, 75000 Paris, France',
      closureDays: ['Sunday'],
      timeSlotDuration: 30,
      reservationStartTime: '08:00',
      reservationEndTime: '20:00',
      maintenanceDay: 'Monday',
      maintenanceDuration: 4,
      pilotLicenses: ['PPL', 'CPL', 'ATPL', 'ULM'],
      membershipFee: 250.0,
      flightHourRate: 180.0,
      clubRules:
        'All pilots must adhere to club safety protocols. Reservations must be made at least 24 hours in advance.',
      allowGuestPilots: true,
      guestPilotFee: 50.0,
      fuelManagement: 'self-service',
      isMaintenanceActive: false,
      maintenanceMessage: null,
      maintenanceTime: null,
      taxonomies: null,
      fuelPrice: 2.45,
    });
    expect(repository.save).toHaveBeenCalledWith(mockAdmin);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Administration configuration created successfully',
    );
  });

  it('should skip creation when administration already exists', async () => {
    // Arrange
    const existingAdmin = { id: 1, clubName: 'Existing Club' };
    repository.findOne.mockResolvedValue(existingAdmin as any);

    // Act
    await seedAdministration(dataSource);

    // Assert
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Administration configuration already exists',
    );
  });

  it('should create administration with correct data types', async () => {
    // Arrange
    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue({} as any);
    repository.save.mockResolvedValue({} as any);

    // Act
    await seedAdministration(dataSource);

    // Assert
    const createCall = repository.create.mock.calls[0][0];
    expect(typeof createCall.clubName).toBe('string');
    expect(typeof createCall.contactEmail).toBe('string');
    expect(typeof createCall.timeSlotDuration).toBe('number');
    expect(typeof createCall.membershipFee).toBe('number');
    expect(typeof createCall.flightHourRate).toBe('number');
    expect(typeof createCall.allowGuestPilots).toBe('boolean');
    expect(Array.isArray(createCall.closureDays)).toBe(true);
    expect(Array.isArray(createCall.pilotLicenses)).toBe(true);
  });

  it('should handle repository errors gracefully', async () => {
    // Arrange
    repository.findOne.mockRejectedValue(new Error('Database error'));

    // Act & Assert
    await expect(seedAdministration(dataSource)).rejects.toThrow(
      'Database error',
    );
  });
});
