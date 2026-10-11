import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedRoles } from './roles.seeder';
import { seedAdminUser } from './user.seeder';
import { seedAdministration } from './admin.seeder';

// What a new installation needs before anyone can sign in: the roles, the
// first administrator and the club settings. Each step leaves existing data
// untouched, so this can run at every start.
export const ensureBaseData = async (dataSource: DataSource): Promise<void> => {
  const logger = new Logger('BaseData');

  try {
    await seedRoles(dataSource);
    await seedAdminUser(dataSource);
    await seedAdministration(dataSource);
  } catch (error) {
    // The application still starts: the message says what is missing.
    logger.error(`Base data could not be created: ${error.message}`);
  }
};
