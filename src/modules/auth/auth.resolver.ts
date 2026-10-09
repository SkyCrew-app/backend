import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginResponse } from './dto/login-response.dto';
import { LoginInput } from './dto/login-input.dto';
import { Response, Request } from 'express';
import {
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';

const TWO_FACTOR_CHALLENGE_COOKIE = 'two_factor_challenge';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  private getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7200000,
      path: '/',
    };
  }

  private getChallengeCookieOptions() {
    return { ...this.getCookieOptions(), maxAge: 300000 };
  }

  @Mutation(() => LoginResponse)
  async login(
    @Args('loginInput') loginInput: LoginInput,
    @Context('res') res: Response,
  ) {
    const user = await this.authService.validateUser(
      loginInput.email,
      loginInput.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const cookieOptions = this.getCookieOptions();
    const is2FAEnabled = !!user.twoFactorAuthSecret;

    res.cookie('email', user.email, cookieOptions);

    if (is2FAEnabled) {
      res.clearCookie('token', cookieOptions);
      res.cookie(
        TWO_FACTOR_CHALLENGE_COOKIE,
        this.authService.createTwoFactorChallenge(user),
        this.getChallengeCookieOptions(),
      );
      return {
        access_token: '',
        is2FAEnabled: true,
      };
    }

    const token = await this.authService.login(user);
    res.cookie('token', token, cookieOptions);

    return {
      access_token: token,
      is2FAEnabled: false,
    };
  }

  @Query(() => String)
  getEmailFromCookie(@Context('req') req: Request): string {
    const email = req.cookies['email'];
    if (!email) {
      throw new Error('Aucun email trouvé dans les cookies');
    }
    return email;
  }

  @Mutation(() => String)
  @UseGuards(JwtAuthGuard)
  async generate2FASecret(
    @Context('req') req: Request & { user: { email: string } },
    // Kept for older clients. The secret is always generated for the
    // authenticated user, never for an email supplied by the caller.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('email', { nullable: true }) _email?: string,
  ) {
    const { qrCodeUrl } = await this.authService.generate2FASecret(
      req.user.email,
    );
    return qrCodeUrl;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async confirm2FA(
    @Context('req') req: Request & { user: { email: string } },
    @Args('token') token: string,
  ): Promise<boolean> {
    const confirmed = await this.authService.confirm2FA(req.user.email, token);

    if (!confirmed) {
      throw new BadRequestException('Invalid 2FA code');
    }

    return true;
  }

  @Mutation(() => LoginResponse)
  async verify2FA(
    @Args('email') email: string,
    @Args('token') token: string,
    @Context('res') res: Response,
    @Context('req') req: Request,
  ) {
    const challenge = req.cookies?.[TWO_FACTOR_CHALLENGE_COOKIE];

    if (!this.authService.isValidTwoFactorChallenge(challenge, email)) {
      throw new UnauthorizedException(
        'Two-factor verification must follow a password login',
      );
    }

    const jwt = await this.authService.verify2FAAndLogin(email, token);

    if (!jwt) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const cookieOptions = this.getCookieOptions();
    res.clearCookie(
      TWO_FACTOR_CHALLENGE_COOKIE,
      this.getChallengeCookieOptions(),
    );
    res.cookie('email', email, cookieOptions);
    res.cookie('token', jwt, cookieOptions);

    return {
      access_token: jwt,
      is2FAEnabled: true,
    };
  }

  @Mutation(() => Boolean)
  async logout(@Context('res') res: Response): Promise<boolean> {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.clearCookie('email', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return true;
  }
}
