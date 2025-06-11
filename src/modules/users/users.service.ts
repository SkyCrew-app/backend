import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { IsNull, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/users.entity';
import { UpdateUserInput } from './dto/update-user.input';
import { MailerService } from '../mail/mailer.service';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UserProgress } from './entity/user-progress.entity';
import { Lesson } from '../e-learning/entity/lesson.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private emailService: MailerService,
    @InjectRepository(UserProgress)
    private readonly userProgressRepository: Repository<UserProgress>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly notificationService: NotificationsService,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['role'],
    });
  }

  findOneById(id: number): Promise<User> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['reservations', 'licenses', 'role'],
    });
  }

  findOneByEmail(email: string): Promise<User> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['reservations', 'licenses', 'role'],
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    const generatedPassword = uuidv4();
    const token = uuidv4();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    userData.password = hashedPassword;

    const newUser = this.usersRepository.create({
      ...userData,
      role: { id: 1 },
      validation_token: token,
    });
    const confirmationUrl = `${process.env.FRONTEND_URL}/auth/new-account?token=${token}`;
    await this.emailService.sendMail(
      newUser.email,
      'Bienvenue sur notre plateforme',
      'Bienvenue sur notre plateforme, veuillez cliquer sur le lien suivant pour confirmer votre adresse email',
      'confirmation-email',
      { name: newUser.first_name, confirmationUrl },
    );
    return this.usersRepository.save(newUser);
  }

  async set2FASecret(email: string, secret: string): Promise<void> {
    const user = await this.findOneByEmail(email);
    if (user) {
      user.twoFactorAuthSecret = secret;
      await this.usersRepository.save(user);
    }

    await this.emailService.sendMail(
      user.email,
      'Authentification à deux facteurs activée',
      "L'authentification à deux facteurs a été activée avec succès",
      '2fa-enabled',
      { first_name: user.first_name },
    );

    await this.notificationService.create({
      user_id: user.id,
      notification_type: '2FA_ENABLED',
      notification_date: new Date(),
      message: 'Authentification à deux facteurs activée',
      is_read: false,
    });
  }

  async setPassword(email: string, password: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) throw new Error('User not found');

    user.password = password;
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
      'Vos informations ont été mises à jour avec succès.',
      'update-user',
      { first_name: user.first_name },
    );

    await this.notificationService.create({
      user_id: user.id,
      notification_type: 'USER_UPDATED',
      notification_date: new Date(),
      message: 'Vos informations ont été mises à jour',
      is_read: false,
    });

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

  async getUserPreferences(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!user) throw new Error('User not found');
    return user;
  }

  async updateUserPreferences(
    userId: number,
    language: string,
    speed_unit: string,
    distance_unit: string,
    timezone: string,
    preferred_aerodrome: string,
  ): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!user) throw new Error('User not found');
    user.language = language;
    user.speed_unit = speed_unit;
    user.distance_unit = distance_unit;
    user.timezone = timezone;
    user.preferred_aerodrome = preferred_aerodrome;
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

  async confirmEmailAndSetPassword(
    token: string,
    password: string,
  ): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { validation_token: token },
    });
    if (!user) throw new Error('User not found');

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.isEmailConfirmed = true;
    user.validation_token = null;

    return this.usersRepository.save(user);
  }

  async getCourseProgress(userId: number, courseId: number): Promise<number> {
    const totalLessons = await this.lessonRepository.count({
      where: { module: { course: { id: courseId } } },
    });
    const completedLessons = await this.userProgressRepository.count({
      where: {
        user: { id: userId },
        lesson: { module: { course: { id: courseId } } },
        completed: true,
      },
    });

    if (totalLessons === 0) return 0;
    return (completedLessons / totalLessons) * 100;
  }

  async markLessonStarted(userId: number, lessonId: number): Promise<void> {
    let progress = await this.userProgressRepository.findOne({
      where: { user: { id: userId }, lesson: { id: lessonId } },
    });

    if (!progress) {
      progress = this.userProgressRepository.create({
        user: { id: userId },
        lesson: { id: lessonId },
        completed: false,
      });
      await this.userProgressRepository.save(progress);
    }
  }

  async markLessonCompleted(userId: number, lessonId: number): Promise<void> {
    await this.userProgressRepository.update(
      { user: { id: userId }, lesson: { id: lessonId } },
      { completed: true, completed_at: new Date() },
    );
  }

  async saveEvaluationResult(
    userId: number,
    evaluationId: number,
    score: number,
    passed: boolean,
  ): Promise<void> {
    const newProgress = this.userProgressRepository.create({
      user: { id: userId } as any,
      evaluation: { id: evaluationId } as any,
      completed_at: new Date(),
      completed: true,
      score,
      passed,
    });
    await this.userProgressRepository.save(newProgress);
  }

  async getEvaluationResults(userId: number): Promise<any[]> {
    const results = await this.userProgressRepository.find({
      where: { user: { id: userId }, evaluation: { id: Not(IsNull()) } },
      relations: ['evaluation', 'evaluation.module'],
    });

    return results;
  }

  async getUserProgress(userId: number, lessonId: number): Promise<boolean> {
    const progress = await this.userProgressRepository.findOne({
      where: { user: { id: userId }, lesson: { id: lessonId } },
    });

    return progress?.completed;
  }
}
