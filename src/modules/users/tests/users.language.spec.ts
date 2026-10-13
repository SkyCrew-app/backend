import { BadRequestException } from '@nestjs/common';
import { UsersResolver } from '../users.resolver';
import { UsersService } from '../users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hash'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('member language', () => {
  let service: UsersService;
  let users: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let mailer: { sendMail: jest.Mock };
  let notifications: { create: jest.Mock };

  const member = (overrides: object = {}) =>
    ({
      id: 3,
      email: 'pilot@example.com',
      first_name: 'Jean',
      language: 'en',
      isEmailConfirmed: true,
      password: 'old-hash',
      ...overrides,
    }) as any;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://club.example';
    users = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn().mockImplementation(async (user) => user),
      create: jest.fn().mockImplementation((user) => user),
      manager: {
        getRepository: () => ({
          findOne: jest.fn().mockResolvedValue({ id: 2, role_name: 'Pilote' }),
        }),
      },
    } as any;
    mailer = { sendMail: jest.fn().mockResolvedValue(true) };
    notifications = { create: jest.fn() };
    service = new UsersService(
      users as any,
      mailer as any,
      {} as any,
      {} as any,
      notifications as any,
    );
  });

  describe('account created by an administrator', () => {
    const account = {
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      date_of_birth: new Date('1990-01-01'),
    };

    it('is written to in French by default', async () => {
      const created = await service.create({ ...account });

      expect(created.language).toBe('fr');
      expect(mailer.sendMail).toHaveBeenCalledWith(
        'ada@example.com',
        'Bienvenue sur notre plateforme',
        expect.stringContaining('veuillez cliquer sur le lien suivant'),
        'confirmation-email',
        expect.objectContaining({ name: 'Ada' }),
        'fr',
      );
    });

    it('gets its activation e-mail in the language it is created with', async () => {
      const created = await service.create({ ...account, language: 'en' });

      expect(created.language).toBe('en');
      expect(mailer.sendMail).toHaveBeenCalledWith(
        'ada@example.com',
        'Welcome to our platform',
        expect.stringContaining('confirm your e-mail address'),
        'confirmation-email',
        expect.objectContaining({
          name: 'Ada',
          confirmationUrl: expect.stringContaining(
            'https://club.example/auth/new-account?token=',
          ),
        }),
        'en',
      );
    });
  });

  describe('e-mails and notifications of an English-speaking member', () => {
    it('announces two-factor authentication in English', async () => {
      users.findOne.mockResolvedValue(
        member({ twoFactorAuthPendingSecret: 'SECRET' }),
      );

      await service.activate2FA('pilot@example.com');

      expect(mailer.sendMail).toHaveBeenCalledWith(
        'pilot@example.com',
        'Two-factor authentication enabled',
        'Two-factor authentication has been enabled successfully',
        '2fa-enabled',
        { name: 'Jean' },
        'en',
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: '2FA_ENABLED',
          message: 'Two-factor authentication enabled',
        }),
      );
    });

    it('sends the password reset link in English', async () => {
      users.findOne.mockResolvedValue(member());

      await service.requestPasswordReset('pilot@example.com');

      const [, subject, text, template, , language] =
        mailer.sendMail.mock.calls[0];
      expect(subject).toBe('Resetting your password');
      expect(text).toBe('A reset of your password has been requested.');
      expect(template).toBe('reset-password');
      expect(language).toBe('en');
    });

    it('confirms a password change in English', async () => {
      users.findOne.mockResolvedValue(member());

      await service.updatePassword(3, 'old', 'new-password');

      expect(mailer.sendMail).toHaveBeenCalledWith(
        'pilot@example.com',
        'Your password has been changed',
        'Your password has been changed successfully',
        'change-password',
        { name: 'Jean' },
        'en',
      );
    });

    it('keeps French for a member whose language is not one we write in', async () => {
      users.findOne.mockResolvedValue(member({ language: 'es' }));

      await service.updatePassword(3, 'old', 'new-password');

      expect(mailer.sendMail.mock.calls[0][1]).toBe(
        'Votre mot de passe a été modifié',
      );
      expect(mailer.sendMail.mock.calls[0][5]).toBe('fr');
    });
  });

  describe('changing the stored language', () => {
    it('stores the language without writing to the member', async () => {
      const user = member({ language: 'fr' });
      users.findOne.mockResolvedValue(user);

      const updated = await service.updateLanguage(3, 'en');

      expect(updated.language).toBe('en');
      expect(users.save).toHaveBeenCalledWith(user);
      expect(mailer.sendMail).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('does nothing when the language is already the stored one', async () => {
      users.findOne.mockResolvedValue(member({ language: 'en' }));

      await service.updateLanguage(3, 'en');

      expect(users.save).not.toHaveBeenCalled();
    });

    it('fails for an unknown member', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(service.updateLanguage(99, 'en')).rejects.toThrow(
        'User not found',
      );
    });

    it('keeps the stored language when the preferences carry an unsupported one', async () => {
      const user = member({ language: 'en' });
      users.findOne.mockResolvedValue(user);

      await service.updateUserPreferences(3, 'es', 'kmh', 'km', 'UTC', 'LFPG');
      expect(user.language).toBe('en');

      await service.updateUserPreferences(
        3,
        undefined,
        'kmh',
        'km',
        'UTC',
        'LFPG',
      );
      expect(user.language).toBe('en');

      await service.updateUserPreferences(3, 'fr', 'kmh', 'km', 'UTC', 'LFPG');
      expect(user.language).toBe('fr');
    });
  });

  describe('API', () => {
    let resolver: UsersResolver;
    let usersService: { updateLanguage: jest.Mock; create: jest.Mock };
    const context = { req: { user: { id: 3, email: 'pilot@example.com' } } };

    beforeEach(() => {
      usersService = {
        updateLanguage: jest.fn().mockResolvedValue({ id: 3, language: 'en' }),
        create: jest.fn(),
      };
      resolver = new UsersResolver(usersService as any);
    });

    it('lets the signed-in member change their own language', async () => {
      await expect(resolver.updateMyLanguage('en', context)).resolves.toEqual({
        id: 3,
        language: 'en',
      });

      expect(usersService.updateLanguage).toHaveBeenCalledWith(3, 'en');
    });

    it.each(['es', 'EN', 'en-GB', ''])(
      'refuses the unsupported language "%s"',
      async (language) => {
        await expect(
          resolver.updateMyLanguage(language, context),
        ).rejects.toThrow(BadRequestException);
        expect(usersService.updateLanguage).not.toHaveBeenCalled();
      },
    );

    it('tells the member their stored language, French when there is none', () => {
      expect(
        resolver.me({
          req: { user: { id: 3, email: 'a@b.c', language: 'en' } },
        }),
      ).toEqual({ id: 3, email: 'a@b.c', language: 'en' });
      expect(resolver.me(context).language).toBe('fr');
    });

    it("creates an account in the administrator's current language", async () => {
      const dob = new Date('1990-01-01');

      await resolver.createUser(
        'Ada',
        'Lovelace',
        'ada@example.com',
        dob,
        undefined,
        'en',
      );

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ada@example.com', language: 'en' }),
        undefined,
      );
    });

    it('creates an account in the language specified for it', async () => {
      const dob = new Date('1990-01-01');

      await resolver.createUser(
        'Ada',
        'Lovelace',
        'ada@example.com',
        dob,
        'fr',
        'en',
      );

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'fr' }),
        undefined,
      );
    });
  });
});
