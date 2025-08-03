import { typeOrmConfig } from './typeorm.config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

describe('typeOrmConfig', () => {
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    configService = { get: jest.fn() };
  });

  it('devrait retourner les options TypeORM avec DATABASE_URL', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'DATABASE_URL')
        return 'postgres://user:pass@localhost:5432/db';
      return undefined;
    });

    const options = typeOrmConfig(configService as ConfigService);

    expect(configService.get).toHaveBeenCalledWith('DATABASE_URL');
    expect(options).toEqual<TypeOrmModuleOptions>({
      type: 'postgres',
      url: 'postgres://user:pass@localhost:5432/db',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: true,
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      // ssl option comment
    });
  });

  it("devrait gérer l'absence de DATABASE_URL (url undefined)", () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);

    const options = typeOrmConfig(configService as ConfigService);

    expect(configService.get).toHaveBeenCalledWith('DATABASE_URL');
    expect((options as any).url).toBeUndefined();
    expect(options.type).toBe('postgres');
    expect(options.synchronize).toBe(true);
    expect(Array.isArray(options.entities)).toBe(true);
    expect(Array.isArray(options.migrations)).toBe(true);
  });
});
