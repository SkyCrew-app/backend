import { ConfigService } from '@nestjs/config';
import { jwtConfig } from './jwt.config';

describe('jwtConfig', () => {
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    configService = { get: jest.fn() };
  });

  it("devrait retourner le secret et l'expiresIn configuré", () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'JWT_SECRET') return 'mysecret';
      if (key === 'JWT_EXPIRES_IN') return '1h';
      return undefined;
    });

    const options = jwtConfig(configService as ConfigService);

    expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN');
    expect(options).toEqual({
      secret: 'mysecret',
      signOptions: { expiresIn: '1h' },
    });
  });

  it('devrait revenir à la valeur par défaut pour expiresIn si non défini', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'JWT_SECRET') return 'anothersecret';
      if (key === 'JWT_EXPIRES_IN') return undefined;
      return undefined;
    });

    const options = jwtConfig(configService as ConfigService);

    expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN');
    expect(options).toEqual({
      secret: 'anothersecret',
      signOptions: { expiresIn: '2h' },
    });
  });
});
