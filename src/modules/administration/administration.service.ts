import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mail/mailer.service';
import { CreateUserInput } from '../users/dto/create-user.input';

@Injectable()
export class AdministrationService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: MailerService,
  ) {}

  async createUserByAdmin(createUserInput: CreateUserInput) {
    const newUser = await this.usersService.create({
      ...createUserInput,
      password: null,
    });

    const confirmationToken = this.jwtService.sign(
      { email: newUser.email },
      { secret: process.env.JWT_SECRET, expiresIn: '1d' },
    );

    await this.sendConfirmationEmail(
      newUser.email,
      confirmationToken,
      newUser.first_name,
    );

    return newUser;
  }

  private async sendConfirmationEmail(
    email: string,
    token: string,
    name: string,
  ) {
    const confirmationUrl = `${process.env.FRONTEND_URL}/auth/new-account?token=${token}`;

    await this.emailService.sendMail(
      email,
      'Confirmez votre compte et définissez votre mot de passe',
      `Veuillez cliquer sur le lien suivant pour confirmer votre compte et créer un mot de passe : ${confirmationUrl}`,
      'confirmation-email',
      { name, confirmationUrl },
    );
  }
}
