import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entity/users.entity';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

export const TWO_FACTOR_PURPOSE = '2fa';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
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
    return this.jwtService.sign(payload, { expiresIn: '2h' });
  }

  async generate2FASecret(userEmail: string) {
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
      return (
        payload.purpose === TWO_FACTOR_PURPOSE && payload.email === userEmail
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

    if (!user?.twoFactorAuthSecret) {
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
