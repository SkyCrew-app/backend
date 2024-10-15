import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginResponse } from './dto/login-response.dto';
import { LoginInput } from './dto/login-input.dto';
import { Response, Request } from 'express';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

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
      throw new Error('Invalid credentials');
    }

    // Définir le cookie dans la réponse
    res.cookie('email', user.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60,
    });

    res.cookie('token', await this.authService.login(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60,
    });

    return {
      access_token: this.authService.login(user),
      is2FAEnabled: user.is2FAEnabled,
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
  async generate2FASecret(@Args('email') email: string) {
    const { qrCodeUrl } = await this.authService.generate2FASecret(email);
    return qrCodeUrl;
  }

  @Mutation(() => Boolean)
  async verify2FA(@Args('email') email: string, @Args('token') token: string) {
    return this.authService.verify2FACode(email, token);
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
