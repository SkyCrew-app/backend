import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entity/users.entity';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { localized } from '../../common/i18n/localized-exception';
import { normalizeEmail } from '../../common/validation/email';

export const TWO_FACTOR_PURPOSE = '2fa';

// How long a session lasts. The token and the cookie that carries it share
// this one value: the cookie must neither outlive the token nor cut it short,
// and nothing else (the frontend least of all) writes that cookie again.
export const SESSION_LIFETIME_SECONDS = 2 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findOneByEmail(email);
    if (
      user?.password &&
      password &&
      (await bcrypt.compare(password, user.password))
    ) {
      return user;
    }
    return null;
  }

  // The password check of a sign-in. A deactivated member is told so, but
  // only once the password is right: nobody else learns the account exists.
  async validateSignIn(email: string, password: string): Promise<User | null> {
    const user = await this.validateUser(email, password);
    if (user && user.is_active === false) {
      throw localized(ForbiddenException, 'error.auth.accountDeactivated');
    }
    return user;
  }

  async login(user: User): Promise<string> {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.role_name,
      // Checked on every request: a session opened before the last password
      // change is no longer accepted.
      sv: user.sessionVersion ?? 0,
    };
    return this.jwtService.sign(payload, {
      expiresIn: SESSION_LIFETIME_SECONDS,
    });
  }

  // Replacing a secret that protects the account takes more than an open
  // session: the password, or a code of the current authenticator.
  private async assertMayReplaceSecret(
    userEmail: string,
    proof: { password?: string; code?: string },
  ): Promise<void> {
    const user = await this.usersService.findOneByEmail(userEmail);
    if (!user?.twoFactorAuthSecret) {
      return;
    }

    const provedByPassword =
      !!proof.password &&
      !!user.password &&
      (await bcrypt.compare(proof.password, user.password));
    const provedByCode =
      !!proof.code &&
      speakeasy.totp.verify({
        secret: user.twoFactorAuthSecret,
        encoding: 'base32',
        token: proof.code,
      });

    if (!provedByPassword && !provedByCode) {
      throw localized(ForbiddenException, 'error.auth.twoFactorProofRequired');
    }
  }

  async generate2FASecret(
    userEmail: string,
    proof: { password?: string; code?: string } = {},
  ) {
    await this.assertMayReplaceSecret(userEmail, proof);

    const secret = speakeasy.generateSecret({
      name: `SkyCrew (${userEmail})`,
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    await this.usersService.set2FASecret(userEmail, secret.base32);

    return { secret: secret.base32, qrCodeUrl };
  }

  // Activates the secret generated for the user once they prove, with a
  // first code, that their authenticator app holds it.
  async confirm2FA(userEmail: string, token: string): Promise<boolean> {
    const user = await this.usersService.findOneByEmail(userEmail);

    if (!user?.twoFactorAuthPendingSecret) {
      return false;
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorAuthPendingSecret,
      encoding: 'base32',
      token,
    });

    if (!isValid) {
      return false;
    }

    await this.usersService.activate2FA(userEmail);
    return true;
  }

  // What a login enforces: a confirmed secret, not the profile flag.
  async isTwoFactorEnabled(userEmail: string): Promise<boolean> {
    const user = await this.usersService.findOneByEmail(userEmail);
    return !!user?.twoFactorAuthSecret;
  }

  // Turning two-factor off requires the current password, so an open
  // session alone is not enough to weaken the account.
  async disable2FA(userEmail: string, password: string): Promise<boolean> {
    const user = await this.validateUser(userEmail, password);

    if (!user) {
      return false;
    }

    await this.usersService.update2FAStatus(userEmail, false);
    return true;
  }

  async verify2FACode(userEmail: string, token: string): Promise<boolean> {
    const user = await this.usersService.findOneByEmail(userEmail);

    return speakeasy.totp.verify({
      secret: user.twoFactorAuthSecret,
      encoding: 'base32',
      token,
    });
  }

  // Proof that the password step succeeded, required to complete a
  // two-factor login. It is not a session token.
  createTwoFactorChallenge(user: User): string {
    return this.jwtService.sign(
      { email: user.email, sub: user.id, purpose: TWO_FACTOR_PURPOSE },
      { expiresIn: '5m' },
    );
  }

  isValidTwoFactorChallenge(
    challenge: string | undefined,
    userEmail: string,
  ): boolean {
    if (!challenge) {
      return false;
    }

    try {
      const payload = this.jwtService.verify(challenge);
      // The address is the one typed at sign-in: its case does not matter.
      return (
        payload.purpose === TWO_FACTOR_PURPOSE &&
        normalizeEmail(payload.email) === normalizeEmail(userEmail)
      );
    } catch {
      return false;
    }
  }

  async verify2FAAndLogin(
    userEmail: string,
    token: string,
  ): Promise<string | null> {
    const user = await this.usersService.findOneByEmail(userEmail);

    if (!user?.twoFactorAuthSecret || user.is_active === false) {
      return null;
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorAuthSecret,
      encoding: 'base32',
      token,
    });

    if (!isValid) {
      return null;
    }

    return this.login(user);
  }
}
