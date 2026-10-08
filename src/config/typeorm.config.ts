import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: configService.get('DATABASE_URL'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true,
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  // ssl: {
  //   rejectUnauthorized: false,
  // },
});
