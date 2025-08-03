import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { seedRoles } from './roles.seeder';
import { seedAdminUser } from './user.seeder';
import { seedAdministration } from './admin.seeder';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('Starting database seeding...');

    await seedRoles(dataSource);
    await seedAdminUser(dataSource);
    await seedAdministration(dataSource);

    console.log('All seeding completed successfully');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
