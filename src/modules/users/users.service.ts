import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { In, IsNull, Not, Raw, Repository } from 'typeorm';
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
import { Role } from '../roles/entity/roles.entity';
import {
  DEFAULT_LANGUAGE,
  Language,
  languageOf,
  parseLanguage,
} from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';
import { ROLE_ADMIN, ROLE_PILOT } from '../../common/auth/access';
import { isEmailAddress, normalizeEmail } from '../../common/validation/email';
import { Notification } from '../notifications/entity/notifications.entity';
import { ReservationTemplate } from '../reservations/entity/reservation-template.entity';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';

const SELF_EDITABLE_FIELDS = [
  'first_name',
  'last_name',
  'phone_number',
  'address',
  'date_of_birth',
  'language',
  'speed_unit',
  'distance_unit',
  'timezone',
] as const;

export const PASSWORD_RESET_VALIDITY_MINUTES = 60;
// How long the link of an invitation works. An administrator can send a new
// one at any time (resendInvitation).
export const INVITATION_VALIDITY_DAYS = 7;
// The one password rule, applied wherever a password is chosen: activation,
// reset and change. Signing in never checks it, so a password chosen under
// an earlier, shorter rule keeps working until its owner changes it.
export const PASSWORD_MIN_LENGTH = 10;

export const assertAcceptablePassword = (password: string): void => {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    throw localized(BadRequestException, 'error.auth.passwordTooShort', {
      min: PASSWORD_MIN_LENGTH,
    });
  }
};

// Only the SHA-256 of a link's token is stored (password reset and
// invitation alike): reading the database does not give a working link.
export const hashLinkToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
const hashResetToken = hashLinkToken;

const invitationExpiry = (): Date =>
  new Date(Date.now() + INVITATION_VALIDITY_DAYS * 24 * 60 * 60_000);

const DEFAULT_MEMBER_ROLE = ROLE_PILOT;

// What belongs to the account itself and goes with it when it is deleted.
// Any other row pointing to a member is history, and forbids the deletion.
const DELETED_WITH_MEMBER: (
  | typeof Notification
  | typeof ReservationTemplate
)[] = [Notification, ReservationTemplate];

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

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

  // The address is matched whatever its case. The exact spelling wins, for
  // the old accounts that would differ only by case.
  private async accountByEmail(
    email: string,
    relations: string[],
  ): Promise<User | null> {
    if (!email) {
      return null;
    }

    const exact = await this.usersRepository.findOne({
      where: { email: email.trim() },
      relations,
    });
    if (exact) {
      return exact;
    }

    return this.usersRepository.findOne({
      where: {
        email: Raw((column) => `LOWER(${column}) = :email`, {
          email: normalizeEmail(email),
        }),
      },
      relations,
      order: { id: 'ASC' },
    });
  }

  findOneByEmail(email: string): Promise<User> {
    return this.accountByEmail(email, ['reservations', 'licenses', 'role']);
  }

  // The account behind a session, looked up on every authenticated request:
  // its role decides what it may do, nothing else is loaded (a member's
  // whole booking history used to come along each time).
  findSessionUser(email: string): Promise<User> {
    return this.accountByEmail(email, ['role']);
  }

  // A new member is a pilot unless the administrator chose another role:
  // nobody becomes an administrator by default.
  private async roleOfNewMember(roleId?: number): Promise<Role> {
    const roles = this.usersRepository.manager.getRepository(Role);
    const role = roleId
      ? await roles.findOne({ where: { id: roleId } })
      : await roles.findOne({ where: { role_name: DEFAULT_MEMBER_ROLE } });
    if (!role) {
      throw new BadRequestException(
        roleId
          ? 'Rôle introuvable'
          : `Rôle « ${DEFAULT_MEMBER_ROLE} » introuvable`,
      );
    }
    return role;
  }

  // `token` is the one put in the link; the account only keeps its hash.
  private async sendInvitation(user: User, token: string): Promise<void> {
    const language = languageOf(user);
    const confirmationUrl = `${process.env.FRONTEND_URL}/auth/new-account?token=${token}`;
    await this.emailService.sendMail(
      user.email,
      translate(language, 'mail.welcome.subject'),
      translate(language, 'mail.welcome.text'),
      'confirmation-email',
      { name: user.first_name, confirmationUrl },
      language,
    );
  }

  async create(userData: Partial<User>, roleId?: number): Promise<User> {
    const email = normalizeEmail(userData.email);
    if (!isEmailAddress(email)) {
      throw localized(BadRequestException, 'error.user.emailInvalid');
    }
    // Checked before anything is sent: nobody receives an invitation for an
    // account that cannot be created.
    if (await this.findOneByEmail(email)) {
      throw localized(ConflictException, 'error.user.emailAlreadyUsed');
    }
    userData.email = email;

    const generatedPassword = uuidv4();
    const token = randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    userData.password = hashedPassword;

    // The account is written to in the language it is created with.
    const language = languageOf(userData);

    const newUser = this.usersRepository.create({
      ...userData,
      language,
      role: await this.roleOfNewMember(roleId),
      validation_token: hashLinkToken(token),
      validationTokenExpiresAt: invitationExpiry(),
    });
    await this.sendInvitation(newUser, token);
    return this.usersRepository.save(newUser);
  }

  // A new link for a member who has not activated their account yet. The
  // previous one stops working.
  async resendInvitation(id: number): Promise<boolean> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw localized(NotFoundException, 'error.user.notFound');
    }
    if (user.isEmailConfirmed) {
      throw localized(BadRequestException, 'error.user.alreadyActivated');
    }

    const token = randomBytes(32).toString('hex');
    user.validation_token = hashLinkToken(token);
    user.validationTokenExpiresAt = invitationExpiry();
    await this.usersRepository.save(user);
    await this.sendInvitation(user, token);
    return true;
  }

  // The club always keeps one administrator able to sign in: the last one
  // can be neither demoted, deactivated nor deleted.
  private async assertNotLastAdministrator(user: User): Promise<void> {
    const administers =
      user.role?.role_name === ROLE_ADMIN &&
      user.is_active !== false &&
      user.isEmailConfirmed;
    if (!administers) {
      return;
    }

    const others = await this.usersRepository.count({
      where: {
        id: Not(user.id),
        is_active: true,
        isEmailConfirmed: true,
        role: { role_name: ROLE_ADMIN },
      },
    });
    if (others === 0) {
      throw localized(ForbiddenException, 'error.user.lastAdministrator');
    }
  }

  // The administrators who can sign in: the ones the club writes to.
  findActiveAdministrators(): Promise<User[]> {
    return this.usersRepository.find({
      where: {
        is_active: true,
        isEmailConfirmed: true,
        role: { role_name: ROLE_ADMIN },
      },
      relations: ['role'],
    });
  }

  private async memberOrFail(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['role'],
    });
    if (!user) {
      throw localized(NotFoundException, 'error.user.notFound');
    }
    return user;
  }

  // What setActive(id, false) would refuse, asked before anything else is
  // done on the member's behalf (see MemberDepartureService).
  async assertMayDeactivate(id: number): Promise<User> {
    const user = await this.memberOrFail(id);
    if (user.is_active !== false) {
      await this.assertNotLastAdministrator(user);
    }
    return user;
  }

  // Deactivating keeps everything the member did and closes the account:
  // no sign-in, and the sessions already open are refused.
  async setActive(id: number, active: boolean): Promise<User> {
    const user = await this.memberOrFail(id);
    if (user.is_active === active) {
      return user;
    }

    if (!active) {
      await this.assertNotLastAdministrator(user);
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
    }
    user.is_active = active;
    return this.usersRepository.save(user);
  }

  // Rows that keep a trace of what the member did, in any module.
  private async hasHistory(userId: number): Promise<boolean> {
    const { manager } = this.usersRepository;

    for (const metadata of manager.connection.entityMetadatas) {
      if ((DELETED_WITH_MEMBER as unknown[]).includes(metadata.target)) {
        continue;
      }
      for (const relation of metadata.manyToOneRelations) {
        if (relation.inverseEntityMetadata.target !== User) {
          continue;
        }
        const rows = await manager.getRepository(metadata.target).count({
          where: { [relation.propertyName]: { id: userId } },
        });
        if (rows > 0) {
          return true;
        }
      }
    }
    return false;
  }

  // Only for an account created by mistake: a member with any history is
  // deactivated instead.
  async remove(id: number): Promise<boolean> {
    const user = await this.memberOrFail(id);
    await this.assertNotLastAdministrator(user);

    if (await this.hasHistory(id)) {
      throw localized(ConflictException, 'error.user.hasHistory');
    }

    try {
      await this.usersRepository.manager.transaction(async (manager) => {
        for (const entity of DELETED_WITH_MEMBER) {
          await manager
            .createQueryBuilder()
            .delete()
            .from(entity)
            .where('"userId" = :id', { id })
            .execute();
        }
        await manager.getRepository(User).delete(id);
      });
    } catch (error) {
      // Foreign key violation: something still points to the member.
      if (error?.code === '23503' || error?.driverError?.code === '23503') {
        throw localized(ConflictException, 'error.user.hasHistory');
      }
      throw error;
    }
    return true;
  }

  // The instructor has, or had, a course with this student.
  async isInstructorOf(
    instructorId: number,
    studentId: number,
  ): Promise<boolean> {
    const courses = await this.usersRepository.manager
      .getRepository(InstructionCourse)
      .count({
        where: { instructor: { id: instructorId }, student: { id: studentId } },
      });
    return courses > 0;
  }

  // Stores the secret shown to the user. It only becomes active once
  // confirmed with a first code, see activate2FA.
  async set2FASecret(email: string, secret: string): Promise<void> {
    const user = await this.findOneByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    user.twoFactorAuthPendingSecret = secret;
    await this.usersRepository.save(user);
  }

  async activate2FA(email: string): Promise<User> {
    const user = await this.findOneByEmail(email);
    if (!user?.twoFactorAuthPendingSecret) {
      throw new Error('No two-factor secret is waiting for confirmation');
    }

    user.twoFactorAuthSecret = user.twoFactorAuthPendingSecret;
    user.twoFactorAuthPendingSecret = null;
    user.is2FAEnabled = true;
    const savedUser = await this.usersRepository.save(user);

    // The account is already protected at this point: a failed email or
    // notification must not make the confirmation look like it failed.
    try {
      const language = languageOf(user);
      await this.emailService.sendMail(
        user.email,
        translate(language, 'mail.twoFactorEnabled.subject'),
        translate(language, 'mail.twoFactorEnabled.text'),
        '2fa-enabled',
        { name: user.first_name },
        language,
      );

      await this.notificationService.create({
        user_id: user.id,
        notification_type: '2FA_ENABLED',
        notification_date: new Date(),
        message: translate(language, 'notification.twoFactorEnabled'),
        is_read: false,
      });
    } catch (error) {
      this.logger.warn(
        `Two-factor confirmation notice not delivered: ${error.message}`,
      );
    }

    return savedUser;
  }

  async updateUser(
    targetEmail: string,
    updateUserInput: UpdateUserInput,
    imagePath: string | null,
    {
      asAdmin = false,
      beforeRoleChange,
    }: {
      asAdmin?: boolean;
      // Runs once the role change is known to be valid, before anything is
      // written; it may refuse the change by throwing.
      beforeRoleChange?: (user: User, newRole: Role) => Promise<void>;
    } = {},
  ): Promise<User> {
    const user = await this.accountByEmail(targetEmail, ['role']);
    if (!user) {
      throw localized(NotFoundException, 'error.user.notFound');
    }

    if (
      updateUserInput.id != null &&
      Number(updateUserInput.id) !== Number(user.id)
    ) {
      throw new BadRequestException(
        'The id does not match the account being updated',
      );
    }

    // Decided before any file or field is touched.
    const newRoleId =
      asAdmin && updateUserInput.roleId ? Number(updateUserInput.roleId) : null;
    let newRole: Role | null = null;
    if (newRoleId && newRoleId !== user.role?.id) {
      newRole = await this.usersRepository.manager
        .getRepository(Role)
        .findOne({ where: { id: newRoleId } });
      if (!newRole) {
        throw localized(BadRequestException, 'error.user.roleNotFound');
      }
      if (newRole.role_name !== ROLE_ADMIN) {
        await this.assertNotLastAdministrator(user);
      }
      await beforeRoleChange?.(user, newRole);
    }

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

    // Only copy the fields the caller may change. The password has its own
    // mutation, and the picture only changes through an upload.
    for (const field of SELF_EDITABLE_FIELDS) {
      if (updateUserInput[field] === undefined) {
        continue;
      }
      if (field === 'language') {
        // A language we do not write in leaves the current one in place.
        user.language =
          parseLanguage(updateUserInput.language) ?? user.language;
        continue;
      }
      (user as any)[field] = updateUserInput[field];
    }

    if (newRole) {
      user.role = newRole;
      // The role travels in the session token, which the interface reads to
      // decide which pages to show: the member signs in again and gets a
      // token with the new role.
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    }

    const language = languageOf(user);
    await this.emailService.sendMail(
      user.email,
      translate(language, 'mail.userUpdated.subject'),
      translate(language, 'mail.userUpdated.text'),
      'update-user',
      { name: user.first_name },
      language,
    );

    await this.notificationService.create({
      user_id: user.id,
      notification_type: 'USER_UPDATED',
      notification_date: new Date(),
      message: translate(language, 'notification.userUpdated'),
      is_read: false,
    });

    return this.usersRepository.save(user);
  }

  async update2FAStatus(email: string, is2FAEnabled: boolean): Promise<User> {
    const user = await this.findOneByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (is2FAEnabled) {
      // Enabling goes through generate2FASecret then confirm2FA.
      if (!user.twoFactorAuthSecret) {
        throw new Error('Two-factor authentication has not been set up');
      }
      user.is2FAEnabled = true;
      return this.usersRepository.save(user);
    }

    user.is2FAEnabled = false;
    user.twoFactorAuthSecret = null;
    user.twoFactorAuthPendingSecret = null;
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
    user.language =
      parseLanguage(language) ?? user.language ?? DEFAULT_LANGUAGE;
    user.speed_unit = speed_unit;
    user.distance_unit = distance_unit;
    user.timezone = timezone;
    user.preferred_aerodrome = preferred_aerodrome;
    return this.usersRepository.save(user);
  }

  // The language the member is written to when they are not there. The
  // interface keeps its own choice, in the browser.
  async updateLanguage(userId: number, language: Language): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    if (user.language === language) {
      return user;
    }
    user.language = language;
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
    assertAcceptablePassword(newPassword);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    // Every session opens again with the new password, this one included.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;

    const first_name = user.first_name;
    const language = languageOf(user);

    await this.emailService.sendMail(
      user.email,
      translate(language, 'mail.passwordChanged.subject'),
      translate(language, 'mail.passwordChanged.text'),
      'change-password',
      { name: first_name },
      language,
    );
    return this.usersRepository.save(user);
  }

  // The answer is the same whether or not the address belongs to a member,
  // so that nobody can learn who has an account.
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.findOneByEmail(email);
    if (!user?.isEmailConfirmed || user.is_active === false) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashResetToken(token);
    user.passwordResetExpiresAt = new Date(
      Date.now() + PASSWORD_RESET_VALIDITY_MINUTES * 60_000,
    );
    await this.usersRepository.save(user);

    try {
      const language = languageOf(user);
      await this.emailService.sendMail(
        user.email,
        translate(language, 'mail.passwordReset.subject'),
        translate(language, 'mail.passwordReset.text'),
        'reset-password',
        {
          first_name: user.first_name,
          resetUrl: `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`,
          validityMinutes: PASSWORD_RESET_VALIDITY_MINUTES,
        },
        language,
      );
    } catch (error) {
      this.logger.error(
        `Password reset e-mail could not be sent: ${error.message}`,
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    assertAcceptablePassword(newPassword);

    const user = token
      ? await this.usersRepository.findOne({
          where: { passwordResetTokenHash: hashResetToken(token) },
        })
      : null;
    const expiresAt = user?.passwordResetExpiresAt;
    if (
      !user ||
      user.is_active === false ||
      !expiresAt ||
      expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Ce lien de réinitialisation est invalide ou a expiré',
      );
    }

    user.password = await bcrypt.hash(newPassword, 10);
    // Whoever was signed in with the old password is signed out.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    // The link works once.
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.usersRepository.save(user);

    try {
      const language = languageOf(user);
      await this.emailService.sendMail(
        user.email,
        translate(language, 'mail.passwordChanged.subject'),
        translate(language, 'mail.passwordChanged.text'),
        'change-password',
        { name: user.first_name },
        language,
      );
    } catch (error) {
      this.logger.error(
        `Password change e-mail could not be sent: ${error.message}`,
      );
    }
    return true;
  }

  async confirmEmailAndSetPassword(
    token: string,
    password: string,
  ): Promise<User> {
    // An empty token must never be looked up: it would match any account.
    const user = token
      ? await this.usersRepository.findOne({
          where: { validation_token: hashLinkToken(token) },
        })
      : null;
    // The same answer for an unknown, an already used and an expired link.
    const expiresAt = user?.validationTokenExpiresAt;
    if (
      !user ||
      user.is_active === false ||
      !expiresAt ||
      new Date(expiresAt).getTime() < Date.now()
    ) {
      throw localized(BadRequestException, 'error.auth.invitationInvalid');
    }
    assertAcceptablePassword(password);

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.isEmailConfirmed = true;
    // The link works once.
    user.validation_token = null;
    user.validationTokenExpiresAt = null;
    // Like every password change: sessions opened before are closed.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;

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
    const completion = { completed: true, completed_at: new Date() };
    const result = await this.userProgressRepository.update(
      { user: { id: userId }, lesson: { id: lessonId } },
      completion,
    );

    // The lesson may be completed without having been marked as started.
    if (!result?.affected) {
      await this.userProgressRepository.save(
        this.userProgressRepository.create({
          user: { id: userId },
          lesson: { id: lessonId },
          ...completion,
        }),
      );
    }
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

    // A lesson never opened has no progress row: it is simply not completed.
    return progress?.completed ?? false;
  }

  // Of the given lessons, the ones the member completed: one query for a
  // whole course instead of one per lesson.
  async getCompletedLessonIds(
    userId: number,
    lessonIds: number[],
  ): Promise<number[]> {
    // A course holds far fewer lessons; the cap keeps the request small.
    const ids = lessonIds.slice(0, 500);
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.userProgressRepository.find({
      where: {
        user: { id: userId },
        lesson: { id: In(ids) },
        completed: true,
      },
      relations: ['lesson'],
    });
    return [
      ...new Set(
        rows
          .map((row) => row.lesson?.id)
          .filter((id): id is number => id != null),
      ),
    ];
  }

  countCompletedLessons(userId: number): Promise<number> {
    return this.userProgressRepository.count({
      where: {
        user: { id: userId },
        lesson: { id: Not(IsNull()) },
        completed: true,
      },
    });
  }

  async updateDashboardWidgets(userId: number, widgets: any[]): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    user.dashboard_widgets = widgets;
    return this.usersRepository.save(user);
  }
}
