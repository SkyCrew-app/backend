import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

// Schema synchronisation is convenient in development but unsafe on real
// data, so production applies migrations instead. DB_SYNCHRONIZE overrides
// the default either way.
const shouldSynchronize = (configService: ConfigService): boolean => {
  const setting = configService.get<string>('DB_SYNCHRONIZE');
  if (setting !== undefined && setting !== '') {
    return setting === 'true';
  }
  return configService.get<string>('NODE_ENV') !== 'production';
};

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const synchronize = shouldSynchronize(configService);

  return {
    type: 'postgres',
    url: configService.get('DATABASE_URL'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize,
    migrationsRun: !synchronize,
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  };
};
