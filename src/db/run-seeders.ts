import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { seedRoles } from './roles.seeder';
import { seedAdminUser } from './user.seeder';
import { seedAdministration } from './admin.seeder';
import { seedDemoUsers } from './demo/demo-users.seeder';
import { seedDemoAircraft } from './demo/demo-aircraft.seeder';
import { seedDemoReservations } from './demo/demo-reservations.seeder';
import { seedDemoFlights } from './demo/demo-flights.seeder';
import { seedDemoMaintenance } from './demo/demo-maintenance.seeder';
import { seedDemoIncidents } from './demo/demo-incidents.seeder';
import { seedDemoLicenses } from './demo/demo-licenses.seeder';
import { seedDemoInvoicesAndPayments } from './demo/demo-invoices.seeder';
import { seedDemoArticles } from './demo/demo-articles.seeder';
import { seedDemoELearning } from './demo/demo-elearning.seeder';
import { seedDemoNotifications } from './demo/demo-notifications.seeder';
import { seedDemoFinancial } from './demo/demo-financial.seeder';
import { seedDemoChecklists } from './demo/demo-checklists.seeder';
import { seedDemoInstruction } from './demo/demo-instruction.seeder';
import { seedDemoAudits } from './demo/demo-audits.seeder';
import { seedDemoEvaluations } from './demo/demo-evaluations.seeder';
import { seedDemoReservationTemplates } from './demo/demo-reservation-templates.seeder';

const isDemoSeed = process.argv.includes('--demo');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('Starting database seeding...');

    // Base seeders (toujours exécutés)
    await seedRoles(dataSource);
    await seedAdminUser(dataSource);
    await seedAdministration(dataSource);

    // Demo seeders (uniquement avec --demo)
    if (isDemoSeed) {
      console.log('\n--- Seeding demo data ---\n');

      const users = await seedDemoUsers(dataSource);
      const aircraft = await seedDemoAircraft(dataSource);
      const reservations = await seedDemoReservations(dataSource, users, aircraft);
      await seedDemoFlights(dataSource, users, reservations);
      await seedDemoMaintenance(dataSource, users, aircraft);
      await seedDemoIncidents(dataSource, users, aircraft);
      await seedDemoLicenses(dataSource, users);
      await seedDemoInvoicesAndPayments(dataSource, users);
      await seedDemoArticles(dataSource);
      await seedDemoELearning(dataSource);
      await seedDemoNotifications(dataSource, users);
      await seedDemoFinancial(dataSource, aircraft);
      await seedDemoChecklists(dataSource, users, reservations);
      await seedDemoInstruction(dataSource, users);
      await seedDemoAudits(dataSource, users, aircraft);
      await seedDemoEvaluations(dataSource, users);
      await seedDemoReservationTemplates(dataSource, users, aircraft);

      console.log('\n--- Demo data seeding completed ---\n');
    }

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
