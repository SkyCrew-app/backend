/* eslint-disable @typescript-eslint/no-unused-vars */
import { calculateScore } from '../calculate-score.util';

describe('calculateScore', () => {
  it('should calculate correct percentage score', () => {
    expect(calculateScore(8, 10)).toBe(80);
    expect(calculateScore(15, 20)).toBe(75);
    expect(calculateScore(7, 10)).toBe(70);
    expect(calculateScore(1, 2)).toBe(50);
  });

  it('should return 0 when total questions is 0', () => {
    expect(calculateScore(5, 0)).toBe(0);
    expect(calculateScore(0, 0)).toBe(0);
    expect(calculateScore(100, 0)).toBe(0);
  });

  it('should return 0 when no correct answers', () => {
    expect(calculateScore(0, 10)).toBe(0);
    expect(calculateScore(0, 5)).toBe(0);
    expect(calculateScore(0, 100)).toBe(0);
  });

  it('should return 100 when all answers are correct', () => {
    expect(calculateScore(10, 10)).toBe(100);
    expect(calculateScore(5, 5)).toBe(100);
    expect(calculateScore(1, 1)).toBe(100);
    expect(calculateScore(25, 25)).toBe(100);
  });

  it('should round to nearest integer', () => {
    // 1/3 = 33.333... should round to 33
    expect(calculateScore(1, 3)).toBe(33);
    // 2/3 = 66.666... should round to 67
    expect(calculateScore(2, 3)).toBe(67);
    // 5/6 = 83.333... should round to 83
    expect(calculateScore(5, 6)).toBe(83);
    // 7/9 = 77.777... should round to 78
    expect(calculateScore(7, 9)).toBe(78);
  });

  it('should handle edge cases', () => {
    // Cas limites
    expect(calculateScore(1, 1000)).toBe(0); // 0.1% rounds to 0
    expect(calculateScore(999, 1000)).toBe(100); // 99.9% rounds to 100
    expect(calculateScore(501, 1000)).toBe(50); // 50.1% rounds to 50
    expect(calculateScore(505, 1000)).toBe(51); // 50.5% rounds to 51
  });

  it('should handle decimal inputs gracefully', () => {
    // Même si normalement on aurait des entiers, test avec des décimaux
    expect(calculateScore(2.5, 5)).toBe(50);
    expect(calculateScore(7.5, 10)).toBe(75);
    expect(calculateScore(1.7, 3.4)).toBe(50);
  });

  it('should handle large numbers', () => {
    expect(calculateScore(80000, 100000)).toBe(80);
    expect(calculateScore(999999, 1000000)).toBe(100);
    expect(calculateScore(500000, 1000000)).toBe(50);
  });

  describe('Invalid inputs', () => {
    it('should handle negative numbers', () => {
      // Comportement avec des nombres négatifs (edge case)
      expect(calculateScore(-5, 10)).toBe(-50);
      expect(calculateScore(5, -10)).toBe(-50);
      expect(calculateScore(-5, -10)).toBe(50);
    });
  });

  describe('Mathematical precision', () => {
    it('should handle floating point precision issues', () => {
      // Test pour les problèmes de précision des nombres flottants
      expect(calculateScore(1, 7)).toBe(14); // 14.285714... rounds to 14
      expect(calculateScore(3, 7)).toBe(43); // 42.857142... rounds to 43
      expect(calculateScore(5, 7)).toBe(71); // 71.428571... rounds to 71
    });
  });
});

import { validateAnswer } from '../validate-answer.util';

describe('validateAnswer', () => {
  it('should return true for exact matches', () => {
    expect(validateAnswer('Paris', 'Paris')).toBe(true);
    expect(validateAnswer('42', '42')).toBe(true);
    expect(validateAnswer('JavaScript', 'JavaScript')).toBe(true);
    expect(validateAnswer('', '')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(validateAnswer('PARIS', 'paris')).toBe(true);
    expect(validateAnswer('Paris', 'PARIS')).toBe(true);
    expect(validateAnswer('jAvAsCrIpT', 'JavaScript')).toBe(true);
    expect(validateAnswer('YES', 'yes')).toBe(true);
    expect(validateAnswer('no', 'NO')).toBe(true);
  });

  it('should trim whitespace', () => {
    expect(validateAnswer('  Paris  ', 'Paris')).toBe(true);
    expect(validateAnswer('Paris', '  Paris  ')).toBe(true);
    expect(validateAnswer('  Paris  ', '  Paris  ')).toBe(true);
    expect(validateAnswer(' JavaScript ', 'JavaScript')).toBe(true);
    expect(validateAnswer('42 ', ' 42')).toBe(true);
  });

  it('should combine case insensitivity and trimming', () => {
    expect(validateAnswer('  PARIS  ', 'paris')).toBe(true);
    expect(validateAnswer('javascript ', '  JAVASCRIPT')).toBe(true);
    expect(validateAnswer('  Yes  ', 'YES')).toBe(true);
    expect(validateAnswer(' 42 ', '42 ')).toBe(true);
  });

  it('should return false for different answers', () => {
    expect(validateAnswer('Paris', 'London')).toBe(false);
    expect(validateAnswer('42', '43')).toBe(false);
    expect(validateAnswer('JavaScript', 'TypeScript')).toBe(false);
    expect(validateAnswer('yes', 'no')).toBe(false);
  });

  it('should handle empty strings', () => {
    expect(validateAnswer('', '')).toBe(true);
    expect(validateAnswer('   ', '')).toBe(true); // Trimmed whitespace becomes empty
    expect(validateAnswer('', '   ')).toBe(true); // Trimmed whitespace becomes empty
    expect(validateAnswer('answer', '')).toBe(false);
    expect(validateAnswer('', 'answer')).toBe(false);
  });

  it('should handle special characters', () => {
    expect(validateAnswer('C++', 'C++')).toBe(true);
    expect(validateAnswer('user@email.com', 'USER@EMAIL.COM')).toBe(true);
    expect(validateAnswer('  #hashtag  ', '#HASHTAG')).toBe(true);
    expect(validateAnswer('50%', '50%')).toBe(true);
    expect(validateAnswer('$100', '$100')).toBe(true);
  });

  it('should handle numbers as strings', () => {
    expect(validateAnswer('123', '123')).toBe(true);
    expect(validateAnswer('  456  ', '456')).toBe(true);
    expect(validateAnswer('0', '0')).toBe(true);
    expect(validateAnswer('-5', '-5')).toBe(true);
    expect(validateAnswer('3.14', '3.14')).toBe(true);
  });

  it('should handle unicode characters', () => {
    expect(validateAnswer('café', 'CAFÉ')).toBe(true);
    expect(validateAnswer('  naïve  ', 'NAÏVE')).toBe(true);
    expect(validateAnswer('résumé', 'RÉSUMÉ')).toBe(true);
    expect(validateAnswer('🚀', '🚀')).toBe(true);
  });

  it('should handle multi-word answers', () => {
    expect(validateAnswer('New York', 'new york')).toBe(true);
    expect(validateAnswer('  HELLO WORLD  ', 'hello world')).toBe(true);
    expect(validateAnswer('United States', 'UNITED STATES')).toBe(true);
  });

  describe('Edge cases', () => {
    it('should handle only whitespace', () => {
      expect(validateAnswer('   ', '   ')).toBe(true);
      expect(validateAnswer('\t\n', '  ')).toBe(true); // Different whitespace types
      expect(validateAnswer('answer', '   ')).toBe(false);
    });

    it('should handle very long strings', () => {
      const longAnswer = 'a'.repeat(1000);
      expect(validateAnswer(longAnswer, longAnswer.toUpperCase())).toBe(true);
      expect(validateAnswer(`  ${longAnswer}  `, longAnswer)).toBe(true);
    });

    it('should preserve internal spacing', () => {
      expect(validateAnswer('a b c', 'A B C')).toBe(true);
      expect(validateAnswer('a  b  c', 'A  B  C')).toBe(true);
      expect(validateAnswer('a b c', 'a  b  c')).toBe(false); // Different internal spacing
    });
  });

  describe('Real-world examples', () => {
    it('should work with typical quiz answers', () => {
      // Questions géographiques
      expect(validateAnswer('france', 'FRANCE')).toBe(true);
      expect(validateAnswer('  PARIS  ', 'paris')).toBe(true);

      // Questions techniques
      expect(validateAnswer('javascript', 'JavaScript')).toBe(true);
      expect(validateAnswer('HTTP', 'http')).toBe(true);

      // Questions mathématiques
      expect(validateAnswer('42', '42')).toBe(true);
      expect(validateAnswer(' 3.14 ', '3.14')).toBe(true);

      // Questions oui/non
      expect(validateAnswer('YES', 'yes')).toBe(true);
      expect(validateAnswer('  true  ', 'TRUE')).toBe(true);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../jwt.strategy';
import { UsersService } from '../../../modules/users/users.service';
import { User } from '../../../modules/users/entity/users.entity';
import { Request } from 'express';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;
  let configService: ConfigService;

  const mockUsersService = {
    findOneByEmail: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-key'), // Retourner la valeur immédiatement
  };

  beforeEach(async () => {
    // S'assurer que le mock retourne la clé avant l'instanciation
    mockConfigService.get.mockReturnValue('test-secret-key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Remettre la valeur par défaut pour le prochain test
    mockConfigService.get.mockReturnValue('test-secret-key');
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockPayload = {
      email: 'test@example.com',
      sub: 1,
      iat: 1234567890,
      exp: 1234567890 + 3600,
    };

    it('should return user when valid payload is provided', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      } as User;

      mockUsersService.findOneByEmail.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockPayload);

      expect(mockUsersService.findOneByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockUsersService.findOneByEmail.mockResolvedValue(null);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockUsersService.findOneByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      mockUsersService.findOneByEmail.mockResolvedValue(undefined);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle payload with different email formats', async () => {
      const testEmails = [
        'user@domain.com',
        'test.user@example.co.uk',
        'user+tag@domain.org',
        'USER@DOMAIN.COM',
      ];

      const mockUser = { id: 1, email: 'test@test.com' } as User;

      for (const email of testEmails) {
        mockUsersService.findOneByEmail.mockResolvedValue(mockUser);

        const payload = { ...mockPayload, email };
        const result = await strategy.validate(payload);

        expect(mockUsersService.findOneByEmail).toHaveBeenCalledWith(email);
        expect(result).toEqual(mockUser);

        mockUsersService.findOneByEmail.mockClear();
      }
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Database connection failed');
      mockUsersService.findOneByEmail.mockRejectedValue(serviceError);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        serviceError,
      );
    });
  });

  describe('constructor configuration', () => {
    it('should configure strategy with correct secret', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete authentication flow', async () => {
      const mockUser = {
        id: 1,
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: { role_name: 'User' },
      } as User;

      const payload = {
        email: 'john.doe@example.com',
        sub: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockUsersService.findOneByEmail.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toBeDefined();
      expect(result.email).toBe('john.doe@example.com');
      expect(result.id).toBe(1);
    });
  });
});
