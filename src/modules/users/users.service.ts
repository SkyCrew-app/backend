import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/users.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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

  // Méthode pour stocker le secret 2FA dans la base de données
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
}
