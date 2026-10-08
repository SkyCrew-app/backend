import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'root',
  password: 'password',
  database: 'mydb',
  entities: ['dist/**/*.entity.ts'],
  logging: true,
  synchronize: false,
  migrationsRun: false,
  migrations: ['dist/**/migrations/*.ts'],
  migrationsTableName: 'history',
});
