import { ConfigService } from '@nestjs/config';
import { redisConfig } from './redis.config';
import { RedisOptions } from 'ioredis';

describe('redisConfig', () => {
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    configService = { get: jest.fn() };
  });

  it('devrait retourner les options de connexion Redis avec host et port', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'REDIS_HOST') return '127.0.0.1';
      if (key === 'REDIS_PORT') return 6379;
      return undefined;
    });

    const options = redisConfig(configService as ConfigService);

    expect(configService.get).toHaveBeenCalledWith('REDIS_HOST');
    expect(configService.get).toHaveBeenCalledWith('REDIS_PORT');
    expect(options).toEqual<RedisOptions>({
      host: '127.0.0.1',
      port: 6379,
    });
  });

  it('devrait utiliser undefined si REDIS_PORT non défini', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'REDIS_HOST') return 'redis.local';
      if (key === 'REDIS_PORT') return undefined;
      return undefined;
    });

    const options = redisConfig(configService as ConfigService);

    expect(configService.get).toHaveBeenCalledWith('REDIS_HOST');
    expect(configService.get).toHaveBeenCalledWith('REDIS_PORT');
    expect(options.host).toBe('redis.local');
    expect(options.port).toBeUndefined();
  });
});
