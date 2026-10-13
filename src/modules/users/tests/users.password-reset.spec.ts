import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import {
  PASSWORD_RESET_VALIDITY_MINUTES,
  UsersService,
} from '../users.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('UsersService password reset', () => {
  let service: UsersService;
  let users: { findOne: jest.Mock; save: jest.Mock };
  let mailer: { sendMail: jest.Mock };

  const member = () =>
    ({
      id: 3,
      email: 'pilot@example.com',
      first_name: 'Jean',
      password: 'old-hash',
      isEmailConfirmed: true,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    }) as any;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://club.example';
    users = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (user) => user),
    };
    mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(
      users as any,
      mailer as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe('requesting a reset', () => {
    it('e-mails a one-time link and only stores the hash of its token', async () => {
      const user = member();
      // Typed in another case: no exact match, found once case is ignored.
      users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user);

      await service.requestPasswordReset(' Pilot@Example.com ');

      // Looked up whatever the case and the spaces around the address.
      expect(
        users.findOne.mock.calls.at(-1)[0].where.email.objectLiteralParameters,
      ).toEqual({ email: 'pilot@example.com' });
      const [to, , , template, variables] = mailer.sendMail.mock.calls[0];
      const token = new URL(variables.resetUrl).searchParams.get('token');

      expect(to).toBe('pilot@example.com');
      expect(template).toBe('reset-password');
      expect(variables.resetUrl).toMatch(
        /^https:\/\/club\.example\/auth\/reset-password\?token=[0-9a-f]{64}$/,
      );
      expect(user.passwordResetTokenHash).toBe(sha256(token));
      expect(user.passwordResetTokenHash).not.toBe(token);

      const validity = user.passwordResetExpiresAt.getTime() - Date.now();
      expect(validity).toBeGreaterThan(
        (PASSWORD_RESET_VALIDITY_MINUTES - 1) * 60_000,
      );
      expect(validity).toBeLessThanOrEqual(
        PASSWORD_RESET_VALIDITY_MINUTES * 60_000,
      );
    });

    it.each([
      ['an unknown address', null],
      ['an account never activated', { ...member(), isEmailConfirmed: false }],
    ])('does nothing and says nothing for %s', async (_label, found) => {
      users.findOne.mockResolvedValue(found);

      await expect(
        service.requestPasswordReset('someone@example.com'),
      ).resolves.toBeUndefined();
      expect(users.save).not.toHaveBeenCalled();
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('answers the same when the e-mail cannot be sent', async () => {
      users.findOne.mockResolvedValue(member());
      mailer.sendMail.mockRejectedValue(new Error('smtp down'));

      await expect(
        service.requestPasswordReset('pilot@example.com'),
      ).resolves.toBeUndefined();
    });
  });

  describe('choosing a new password', () => {
    const TOKEN = 'a'.repeat(64);
    const withValidToken = () => ({
      ...member(),
      passwordResetTokenHash: sha256(TOKEN),
      passwordResetExpiresAt: new Date(Date.now() + 10 * 60_000),
    });

    it('sets the password and makes the link unusable afterwards', async () => {
      const user = withValidToken();
      users.findOne.mockResolvedValue(user);

      await expect(
        service.resetPassword(TOKEN, 'nouveau-secret'),
      ).resolves.toBe(true);

      expect(users.findOne).toHaveBeenCalledWith({
        where: { passwordResetTokenHash: sha256(TOKEN) },
      });
      expect(await bcrypt.compare('nouveau-secret', user.password)).toBe(true);
      expect(user.passwordResetTokenHash).toBeNull();
      expect(user.passwordResetExpiresAt).toBeNull();
      // Sessions opened with the old password are closed.
      expect(user.sessionVersion).toBe(1);
      expect(mailer.sendMail.mock.calls[0][3]).toBe('change-password');
    });

    it.each([
      ['an unknown token', null],
      [
        'an expired token',
        {
          ...member(),
          passwordResetTokenHash: sha256(TOKEN),
          passwordResetExpiresAt: new Date(Date.now() - 1000),
        },
      ],
      [
        'a token without expiry',
        { ...member(), passwordResetTokenHash: sha256(TOKEN) },
      ],
    ])('refuses %s', async (_label, found) => {
      users.findOne.mockResolvedValue(found);

      await expect(
        service.resetPassword(TOKEN, 'nouveau-secret'),
      ).rejects.toThrow(BadRequestException);
      expect(users.save).not.toHaveBeenCalled();
    });

    it('refuses an empty token without looking anyone up', async () => {
      await expect(service.resetPassword('', 'nouveau-secret')).rejects.toThrow(
        BadRequestException,
      );
      expect(users.findOne).not.toHaveBeenCalled();
    });

    it('refuses a password that is too short, before using the link', async () => {
      await expect(service.resetPassword(TOKEN, 'court')).rejects.toThrow(
        BadRequestException,
      );
      expect(users.findOne).not.toHaveBeenCalled();
    });
  });
});
