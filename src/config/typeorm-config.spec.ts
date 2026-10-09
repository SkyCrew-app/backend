import { typeOrmConfig } from './typeorm.config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

describe('typeOrmConfig', () => {
  const configWith = (values: Record<string, string | undefined>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  it('devrait retourner les options TypeORM avec DATABASE_URL', () => {
    const configService = configWith({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    });

    const options = typeOrmConfig(configService);

    expect(configService.get).toHaveBeenCalledWith('DATABASE_URL');
    expect(options).toEqual<TypeOrmModuleOptions>({
      type: 'postgres',
      url: 'postgres://user:pass@localhost:5432/db',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: true,
      migrationsRun: false,
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    });
  });

  it("devrait gérer l'absence de DATABASE_URL (url undefined)", () => {
    const options = typeOrmConfig(configWith({}));

    expect((options as any).url).toBeUndefined();
    expect(options.type).toBe('postgres');
    expect(options.synchronize).toBe(true);
    expect(Array.isArray(options.entities)).toBe(true);
    expect(Array.isArray(options.migrations)).toBe(true);
  });

  it('devrait appliquer les migrations au lieu de synchroniser en production', () => {
    const options = typeOrmConfig(configWith({ NODE_ENV: 'production' }));

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(true);
  });

  it('devrait permettre de forcer la synchronisation en production', () => {
    const options = typeOrmConfig(
      configWith({ NODE_ENV: 'production', DB_SYNCHRONIZE: 'true' }),
    );

    expect(options.synchronize).toBe(true);
    expect(options.migrationsRun).toBe(false);
  });

  it('devrait permettre de désactiver la synchronisation hors production', () => {
    const options = typeOrmConfig(
      configWith({ NODE_ENV: 'development', DB_SYNCHRONIZE: 'false' }),
    );

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(true);
  });
});
