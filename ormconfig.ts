import 'dotenv/config';
import { DataSource } from 'typeorm';

// Data source used by the TypeORM CLI (migration:generate, migration:run…).
// The application itself is configured in src/config/typeorm.config.ts.
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/src/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/src/migrations/*{.ts,.js}'],
  synchronize: false,
});
