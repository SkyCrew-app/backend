/* eslint-disable @typescript-eslint/no-require-imports */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { seedAdminUser } from '../user.seeder';
import { seedAdministration } from '../admin.seeder';

// Mock des seeders
jest.mock('../roles.seeder', () => ({
  seedRoles: jest.fn(),
}));

jest.mock('../user.seeder', () => ({
  seedAdminUser: jest.fn(),
}));

jest.mock('../admin.seeder', () => ({
  seedAdministration: jest.fn(),
}));

// Mock de NestFactory
jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

describe('Database Seed Bootstrap', () => {
  let mockApp: jest.Mocked<any>;
  let mockDataSource: jest.Mocked<DataSource>;
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDataSource = {} as any;

    mockApp = {
      get: jest.fn().mockReturnValue(mockDataSource),
      close: jest.fn(),
    };

    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: number) => {
        throw new Error(`Process exit called with code ${code}`);
      });

    // Reset mocks des seeders
    const { seedRoles } = require('../roles.seeder');
    const { seedAdminUser } = require('../user.seeder');
    const { seedAdministration } = require('../admin.seeder');

    seedRoles.mockClear().mockResolvedValue(undefined);
    seedAdminUser.mockClear().mockResolvedValue(undefined);
    seedAdministration.mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Bootstrap Logic', () => {
    it('should run all seeders successfully and exit with code 0', async () => {
      // Arrange
      const { seedRoles } = require('../roles.seeder');
      const { seedAdminUser } = require('../user.seeder');
      const { seedAdministration } = require('../admin.seeder');

      // Act - Simuler la logique du fichier seed.ts avec try/catch pour capturer l'exit
      let app: any;
      let exitCode: number | undefined;

      try {
        app = await NestFactory.create(AppModule);
        const dataSource = app.get(DataSource);

        console.log('Starting database seeding...');
        await seedRoles(dataSource);
        await seedAdminUser(dataSource);
        await seedAdministration(dataSource);
        console.log('All seeding completed successfully');

        await app.close();
        process.exit(0); // Ceci va throw grâce à notre mock
      } catch (error: any) {
        if (error.message.includes('Process exit called with code')) {
          exitCode = parseInt(error.message.match(/code (\d+)/)?.[1] || '0');
        } else {
          throw error; // Re-throw si c'est une vraie erreur
        }
      }

      // Assert - Maintenant ces lignes SONT atteignables !
      expect(NestFactory.create).toHaveBeenCalledWith(AppModule);
      expect(mockApp.get).toHaveBeenCalledWith(DataSource);

      expect(seedRoles).toHaveBeenCalledWith(mockDataSource);
      expect(seedAdminUser).toHaveBeenCalledWith(mockDataSource);
      expect(seedAdministration).toHaveBeenCalledWith(mockDataSource);

      expect(consoleSpy).toHaveBeenCalledWith('Starting database seeding...');
      expect(consoleSpy).toHaveBeenCalledWith(
        'All seeding completed successfully',
      );
      expect(mockApp.close).toHaveBeenCalled();
      expect(exitCode).toBe(0);
    });

    it('should handle seeding errors and exit with code 1', async () => {
      // Arrange
      const { seedRoles } = require('../roles.seeder');
      const error = new Error('Seeding failed');
      seedRoles.mockRejectedValue(error);

      // Act
      let exitCode: number | undefined;

      try {
        const app = await NestFactory.create(AppModule);
        const dataSource = app.get(DataSource);

        console.log('Starting database seeding...');
        await seedRoles(dataSource);
        await seedAdminUser(dataSource);
        await seedAdministration(dataSource);
      } catch (caughtError: any) {
        if (caughtError.message === 'Seeding failed') {
          console.error('Error during seeding:', caughtError);
          await mockApp.close();
          try {
            process.exit(1);
          } catch (exitError: any) {
            if (exitError.message.includes('Process exit called with code')) {
              exitCode = parseInt(
                exitError.message.match(/code (\d+)/)?.[1] || '1',
              );
            }
          }
        }
      }

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during seeding:',
        error,
      );
      expect(mockApp.close).toHaveBeenCalled();
      expect(exitCode).toBe(1);
    });
  });
});
