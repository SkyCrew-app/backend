import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entity/users.entity';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

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

  async verify2FACode(userEmail: string, token: string): Promise<boolean> {
    const user = await this.usersService.findOneByEmail(userEmail);

    return speakeasy.totp.verify({
      secret: user.twoFactorAuthSecret,
      encoding: 'base32',
      token,
    });
  }
}
