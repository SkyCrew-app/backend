import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/users.entity';
import { UpdateUserInput } from './dto/update-user.input';
import { MailerService } from '../mail/mailer.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private emailService: MailerService,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  findOneByEmail(email: string): Promise<User> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async create(userData: Partial<User>): Promise<User> {
    if (userData.password) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      userData.password = hashedPassword;
    }

    const newUser = this.usersRepository.create(userData);
    return this.usersRepository.save(newUser);
  }

  async set2FASecret(email: string, secret: string): Promise<void> {
    const user = await this.findOneByEmail(email);
    if (user) {
      user.twoFactorAuthSecret = secret;
      await this.usersRepository.save(user);
    }
  }

  async setPassword(email: string, password: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) throw new Error('User not found');

    user.password = password;
    await this.usersRepository.save(user);
  }

  async confirmEmail(email: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) throw new Error('User not found');

    user.isEmailConfirmed = true;
    await this.usersRepository.save(user);
  }

  async updateUser(
    updateUserInput: UpdateUserInput,
    imagePath: string | null,
  ): Promise<User> {
    const user = await this.usersRepository.findOneOrFail({
      where: { email: updateUserInput.email },
    });

    const userDir = path.join(
      __dirname,
      '../../uploads/users',
      String(user.id),
    );

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    if (imagePath) {
      const destinationImagePath = path.join(userDir, path.basename(imagePath));
      fs.renameSync(imagePath, destinationImagePath);
      user.profile_picture = `/uploads/users/${user.id}/${path.basename(imagePath)}`;
    }

    Object.assign(user, updateUserInput);

    await this.emailService.sendMail(
      user.email,
      'Vos informations ont été mises à jour',
      'Vos informations ont été mises à jour avec succès',
      'update-user',
      { first_name: user.first_name },
    );

    return this.usersRepository.save(user);
  }

  async update2FAStatus(email: string, is2FAEnabled: boolean): Promise<User> {
    const user = await this.findOneByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    await this.emailService.sendMail(
      user.email,
      'Authentification à deux facteurs activée',
      "L'authentification à deux facteurs a été activée avec succès",
      '2fa-enabled',
      { first_name: user.first_name },
    );

    user.is2FAEnabled = is2FAEnabled;
    return this.usersRepository.save(user);
  }

  async updateNotificationSettings(
    userId: number,
    email_notifications_enabled: boolean,
    sms_notifications_enabled: boolean,
    newsletter_subscribed: boolean,
  ): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    user.email_notifications_enabled = email_notifications_enabled;
    user.sms_notifications_enabled = sms_notifications_enabled;
    user.newsletter_subscribed = newsletter_subscribed;

    return this.usersRepository.save(user);
  }

  async updatePassword(
    id: number,
    password: string,
    newPassword: string,
  ): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new Error('User not found');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error('Invalid password');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    const first_name = user.first_name;

    await this.emailService.sendMail(
      user.email,
      'Votre mot de passe a été modifié',
      'Votre mot de passe a été modifié avec succès',
      'change-password',
      { first_name },
    );
    return this.usersRepository.save(user);
  }
}
