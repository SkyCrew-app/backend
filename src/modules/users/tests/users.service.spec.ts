import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
// on mock uuid.v4 en tête de fichier pour éviter le spyOn interdit
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { UsersService } from '../users.service';
import { User } from '../entity/users.entity';
import { UserProgress } from '../entity/user-progress.entity';
import { Lesson } from '../../e-learning/entity/lesson.entity';
import { MailerService } from '../../mail/mailer.service';
import { NotificationsService } from '../../notifications/notifications.service';

type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;
const createMockRepository = <T = any>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: MockRepository<User>;
  let userProgressRepository: MockRepository<UserProgress>;
  let lessonRepository: MockRepository<Lesson>;
  let mailerService: MailerService;
  let notificationsService: NotificationsService;

  beforeAll(() => {
    process.env.FRONTEND_URL = 'http://frontend.test';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository<User>(),
        },
        {
          provide: getRepositoryToken(UserProgress),
          useValue: createMockRepository<UserProgress>(),
        },
        {
          provide: getRepositoryToken(Lesson),
          useValue: createMockRepository<Lesson>(),
        },
        {
          provide: MailerService,
          useValue: { sendMail: jest.fn().mockResolvedValue(true) },
        },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<MockRepository<User>>(getRepositoryToken(User));
    userProgressRepository = module.get<MockRepository<UserProgress>>(
      getRepositoryToken(UserProgress),
    );
    lessonRepository = module.get<MockRepository<Lesson>>(
      getRepositoryToken(Lesson),
    );
    mailerService = module.get<MailerService>(MailerService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('devrait récupérer tous les utilisateurs avec leurs rôles', async () => {
      const usersArray = [
        { id: 1, first_name: 'Alice' },
        { id: 2, first_name: 'Bob' },
      ];
      userRepository.find.mockResolvedValue(usersArray);

      const result = await service.findAll();

      expect(userRepository.find).toHaveBeenCalledWith({ relations: ['role'] });
      expect(result).toEqual(usersArray);
    });
  });

  describe('findOneById', () => {
    it('devrait trouver un utilisateur par son ID avec ses réservations, licences et rôle', async () => {
      const user = { id: 1, first_name: 'Alice' } as User;
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.findOneById(1);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['reservations', 'licenses', 'role'],
      });
      expect(result).toBe(user);
    });
  });

  describe('findOneByEmail', () => {
    it('devrait trouver un utilisateur par son email avec ses réservations, licences et rôle', async () => {
      const user = { id: 2, email: 'test@example.com' } as User;
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.findOneByEmail('test@example.com');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['reservations', 'licenses', 'role'],
      });
      expect(result).toBe(user);
    });
  });

  describe('create', () => {
    it("devrait créer un nouvel utilisateur avec mot de passe généré, envoyer un email de confirmation, et retourner l'utilisateur", async () => {
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce('generated-pass-uuid')
        .mockReturnValueOnce('validation-token-uuid');
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');

      const newUserData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        date_of_birth: new Date('2000-01-01'),
      };
      const savedUser = {
        id: 5,
        ...newUserData,
        password: 'hashedPassword',
        role: { id: 1 },
        validation_token: 'validation-token-uuid',
      } as User;
      userRepository.create.mockReturnValue({
        id: 5,
        ...newUserData,
        role: { id: 1 },
        validation_token: 'validation-token-uuid',
      });
      userRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(newUserData);

      expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 10);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          role: { id: 1 },
          validation_token: 'validation-token-uuid',
        }),
      );
      const expectedUrl = `http://frontend.test/auth/new-account?token=validation-token-uuid`;
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        'john.doe@example.com',
        'Bienvenue sur notre plateforme',
        expect.stringContaining('veuillez cliquer sur le lien suivant'),
        'confirmation-email',
        { name: 'John', confirmationUrl: expectedUrl },
      );
      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toEqual(savedUser);
    });
  });

  describe('set2FASecret', () => {
    it("devrait enregistrer le secret 2FA de l'utilisateur, envoyer un email et créer une notification", async () => {
      const user = {
        id: 10,
        email: 'twofa@example.com',
        first_name: 'Jean',
        twoFactorAuthSecret: null,
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      (mailerService.sendMail as jest.Mock).mockResolvedValue(true);

      await service.set2FASecret('twofa@example.com', 'SECRET123');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'twofa@example.com' },
        relations: ['reservations', 'licenses', 'role'],
      });
      expect(user.twoFactorAuthSecret).toBe('SECRET123');
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        'twofa@example.com',
        'Authentification à deux facteurs activée',
        expect.any(String),
        '2fa-enabled',
        { first_name: 'Jean' },
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 10,
          notification_type: '2FA_ENABLED',
          message: 'Authentification à deux facteurs activée',
        }),
      );
    });
  });

  describe('setPassword', () => {
    it("devrait lever une erreur si l'utilisateur n'existe pas (email inconnu)", async () => {
      userRepository.findOne.mockResolvedValue(undefined);

      await expect(
        service.setPassword('noexist@example.com', 'newPass'),
      ).rejects.toThrow('User not found');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'noexist@example.com' },
      });
    });

    it("devrait mettre à jour le mot de passe de l'utilisateur s'il existe", async () => {
      const user = {
        id: 7,
        email: 'exists@example.com',
        password: 'oldpass',
      } as User;
      userRepository.findOne.mockResolvedValue(user);

      await service.setPassword('exists@example.com', 'newPassword123');

      expect(user.password).toBe('newPassword123');
      expect(userRepository.save).toHaveBeenCalledWith(user);
    });
  });

  describe('updateUser', () => {
    it("devrait mettre à jour les informations de l'utilisateur et éventuellement sa photo de profil", async () => {
      const existingUser = {
        id: 3,
        email: 'update@example.com',
        first_name: 'Old',
        last_name: 'Name',
      } as User;
      const updateInput = {
        email: 'update@example.com',
        first_name: 'NewName',
        address: 'NewAddress',
      };
      userRepository.findOneOrFail.mockResolvedValue(existingUser);
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSpy = jest
        .spyOn(fs, 'mkdirSync')
        .mockImplementation(() => undefined);
      const renameSpy = jest
        .spyOn(fs, 'renameSync')
        .mockImplementation(() => undefined);
      userRepository.save.mockResolvedValue({
        ...existingUser,
        ...updateInput,
      });

      // Appel sans imagePath (imagePath = null)
      const updatedUser = await service.updateUser(updateInput, null);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        existingUser.email,
        'Vos informations ont été mises à jour',
        expect.any(String),
        'update-user',
        { first_name: 'NewName' },
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 3,
          notification_type: 'USER_UPDATED',
        }),
      );
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'NewName',
          address: 'NewAddress',
        }),
      );
      expect(updatedUser.first_name).toBe('NewName');

      // Appel avec un chemin d'image fourni
      const imagePath = '/uploads/tmp/profile.png';
      await service.updateUser(updateInput, imagePath);
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining(`/uploads/users/3`),
      );
      expect(mkdirSpy).toHaveBeenCalled();
      expect(renameSpy).toHaveBeenCalledWith(
        imagePath,
        expect.stringContaining(`/uploads/users/3/profile.png`),
      );
      expect(existingUser.profile_picture).toEqual(
        expect.stringContaining(`/uploads/users/3/profile.png`),
      );
    });
  });

  describe('update2FAStatus', () => {
    it("devrait lever une erreur si l'utilisateur n'existe pas", async () => {
      userRepository.findOne.mockResolvedValue(undefined);
      await expect(
        service.update2FAStatus('unknown@example.com', true),
      ).rejects.toThrow('User not found');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'unknown@example.com' },
        relations: ['reservations', 'licenses', 'role'],
      });
    });

    it("devrait mettre à jour le statut 2FA de l'utilisateur et envoyer un email", async () => {
      const user = {
        id: 11,
        email: 'foo@bar.com',
        first_name: 'Foo',
        is2FAEnabled: false,
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      // Simule la sauvegarde pour renvoyer l’utilisateur
      userRepository.save.mockResolvedValue(user);
      (mailerService.sendMail as jest.Mock).mockResolvedValue(true);

      const result = await service.update2FAStatus('foo@bar.com', true);

      expect(user.is2FAEnabled).toBe(true);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        'foo@bar.com',
        'Authentification à deux facteurs activée',
        expect.any(String),
        '2fa-enabled',
        { first_name: 'Foo' },
      );
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });
  });

  describe('getUserPreferences', () => {
    it("devrait renvoyer les préférences de l'utilisateur si l'utilisateur existe", async () => {
      const user = { id: 20, language: 'fr', role: {} } as User;
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getUserPreferences(20);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 20 },
        relations: ['role'],
      });
      expect(result).toBe(user);
    });

    it("devrait lever une erreur si l'utilisateur n'est pas trouvé", async () => {
      userRepository.findOne.mockResolvedValue(undefined);
      await expect(service.getUserPreferences(99)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('updateUserPreferences', () => {
    it("devrait mettre à jour et renvoyer les préférences de l'utilisateur", async () => {
      const user = {
        id: 15,
        language: 'en',
        speed_unit: 'kph',
        distance_unit: 'km',
        timezone: 'UTC',
        preferred_aerodrome: 'ABC',
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue({
        ...user,
        language: 'fr',
        speed_unit: 'mph',
      });

      const result = await service.updateUserPreferences(
        15,
        'fr',
        'mph',
        'mi',
        'GMT',
        'XYZ',
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 15 },
        relations: ['role'],
      });
      expect(user.language).toBe('fr');
      expect(user.speed_unit).toBe('mph');
      expect(user.distance_unit).toBe('mi');
      expect(user.timezone).toBe('GMT');
      expect(user.preferred_aerodrome).toBe('XYZ');
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result.language).toBe('fr');
      expect(result.speed_unit).toBe('mph');
    });
  });

  describe('updateNotificationSettings', () => {
    it("devrait mettre à jour les paramètres de notification de l'utilisateur", async () => {
      const user = {
        id: 25,
        email_notifications_enabled: false,
        sms_notifications_enabled: true,
        newsletter_subscribed: false,
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue({
        ...user,
        email_notifications_enabled: true,
      });

      const result = await service.updateNotificationSettings(
        25,
        true,
        false,
        true,
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 25 },
      });
      expect(user.email_notifications_enabled).toBe(true);
      expect(user.sms_notifications_enabled).toBe(false);
      expect(user.newsletter_subscribed).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result.email_notifications_enabled).toBe(true);
    });
  });

  describe('updatePassword', () => {
    it("devrait lever une erreur si l'utilisateur n'existe pas", async () => {
      userRepository.findOne.mockResolvedValue(undefined);
      await expect(service.updatePassword(999, 'old', 'new')).rejects.toThrow(
        'User not found',
      );
    });

    it('devrait lever une erreur si le mot de passe actuel est invalide', async () => {
      const user = {
        id: 30,
        password: 'hashedOldPassword',
        email: 'x@y.com',
        first_name: 'X',
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(
        service.updatePassword(30, 'wrongPassword', 'newPass'),
      ).rejects.toThrow('Invalid password');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongPassword',
        'hashedOldPassword',
      );
    });

    it('devrait mettre à jour le mot de passe si le mot de passe actuel est correct', async () => {
      const user = {
        id: 31,
        password: 'hashedOldPassword',
        email: 'demo@demo.com',
        first_name: 'Demo',
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('newHashedPassword');
      (mailerService.sendMail as jest.Mock).mockResolvedValue(true);
      userRepository.save.mockResolvedValue({
        ...user,
        password: 'newHashedPassword',
      });

      const result = await service.updatePassword(
        31,
        'correctPassword',
        'newPassword!',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correctPassword',
        'hashedOldPassword',
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword!', 10);
      expect(user.password).toBe('newHashedPassword');
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        user.email,
        'Votre mot de passe a été modifié',
        expect.any(String),
        'change-password',
        { first_name: 'Demo' },
      );
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result.password).toBe('newHashedPassword');
    });
  });

  describe('confirmEmailAndSetPassword', () => {
    it("devrait lever une erreur si aucun utilisateur n'a le token fourni", async () => {
      userRepository.findOne.mockResolvedValue(undefined);
      await expect(
        service.confirmEmailAndSetPassword('invalid-token', 'Pass123'),
      ).rejects.toThrow('User not found');
    });

    it("devrait confirmer l'email, définir le mot de passe et renvoyer l'utilisateur mis à jour", async () => {
      const user = {
        id: 40,
        validation_token: 'valid-token',
        isEmailConfirmed: false,
        password: 'old',
        email: 'test@xyz.com',
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedNewPass');
      userRepository.save.mockResolvedValue({
        ...user,
        password: 'hashedNewPass',
        isEmailConfirmed: true,
        validation_token: null,
      });

      const result = await service.confirmEmailAndSetPassword(
        'valid-token',
        'NewPass!',
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { validation_token: 'valid-token' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass!', 10);
      expect(user.isEmailConfirmed).toBe(true);
      expect(user.validation_token).toBeNull();
      expect(user.password).toBe('hashedNewPass');
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result.isEmailConfirmed).toBe(true);
      expect(result.validation_token).toBeNull();
    });
  });

  describe('getCourseProgress', () => {
    it("devrait retourner 0 si le cours n'a aucune leçon", async () => {
      lessonRepository.count.mockResolvedValue(0);

      const progress = await service.getCourseProgress(5, 100);

      expect(progress).toBe(0);
    });

    it('devrait retourner le pourcentage de progression du cours', async () => {
      lessonRepository.count.mockResolvedValue(10);
      userProgressRepository.count.mockResolvedValue(7);

      const progress = await service.getCourseProgress(1, 50);

      expect(lessonRepository.count).toHaveBeenCalledWith({
        where: { module: { course: { id: 50 } } },
      });
      expect(userProgressRepository.count).toHaveBeenCalledWith({
        where: {
          user: { id: 1 },
          lesson: { module: { course: { id: 50 } } },
          completed: true,
        },
      });
      expect(progress).toBeCloseTo(70);
    });
  });

  describe('markLessonStarted', () => {
    it("devrait créer un UserProgress si aucune progression n'existe déjà pour la leçon", async () => {
      userProgressRepository.findOne.mockResolvedValue(undefined);
      const createdProgress = {
        id: 1,
        user: { id: 1 },
        lesson: { id: 2 },
        completed: false,
      };
      userProgressRepository.create.mockReturnValue(createdProgress);
      userProgressRepository.save.mockResolvedValue(createdProgress);

      await service.markLessonStarted(1, 2);

      expect(userProgressRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: 1 }, lesson: { id: 2 } },
      });
      expect(userProgressRepository.create).toHaveBeenCalledWith({
        user: { id: 1 },
        lesson: { id: 2 },
        completed: false,
      });
      expect(userProgressRepository.save).toHaveBeenCalledWith(createdProgress);
    });

    it('ne devrait pas créer de doublon si une progression existe déjà', async () => {
      const existingProgress = {
        id: 5,
        user: { id: 1 },
        lesson: { id: 2 },
        completed: false,
      } as UserProgress;
      userProgressRepository.findOne.mockResolvedValue(existingProgress);

      await service.markLessonStarted(1, 2);

      expect(userProgressRepository.findOne).toHaveBeenCalled();
      expect(userProgressRepository.create).not.toHaveBeenCalled();
      expect(userProgressRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('markLessonCompleted', () => {
    it("devrait marquer une leçon comme complétée avec la date d'achèvement actuelle", async () => {
      const userId = 2,
        lessonId = 3;
      userProgressRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.markLessonCompleted(userId, lessonId);

      expect(userProgressRepository.update).toHaveBeenCalledWith(
        { user: { id: userId }, lesson: { id: lessonId } },
        { completed: true, completed_at: expect.any(Date) },
      );
      const updateArg = userProgressRepository.update.mock
        .calls[0][1] as Partial<UserProgress>;
      expect(updateArg.completed_at).toBeInstanceOf(Date);
    });
  });

  describe('saveEvaluationResult', () => {
    it('devrait créer une nouvelle entrée de UserProgress pour une évaluation et la sauvegarder', async () => {
      const userId = 5,
        evaluationId = 99;
      let createdObject: Partial<UserProgress> | undefined;
      userProgressRepository.create.mockImplementation((obj) => {
        createdObject = obj;
        return obj;
      });
      userProgressRepository.save.mockResolvedValue({} as UserProgress);

      const score = 80,
        passed = true;
      const before = Date.now();
      await service.saveEvaluationResult(userId, evaluationId, score, passed);

      expect(userProgressRepository.create).toHaveBeenCalledWith({
        user: { id: userId },
        evaluation: { id: evaluationId },
        completed_at: expect.any(Date),
        completed: true,
        score,
        passed,
      });
      expect(userProgressRepository.save).toHaveBeenCalled();
      expect(createdObject!.completed_at.getTime()).toBeGreaterThanOrEqual(
        before,
      );
      expect(createdObject!.completed).toBe(true);
      expect(createdObject!.score).toBe(80);
      expect(createdObject!.passed).toBe(true);
    });
  });

  describe('getEvaluationResults', () => {
    it("devrait renvoyer les résultats d'évaluation de l'utilisateur", async () => {
      const userId = 42;
      const evalResults = [
        { id: 1, evaluation: { id: 10, module: {} }, score: 85 },
        { id: 2, evaluation: { id: 11, module: {} }, score: 60 },
      ] as UserProgress[];
      userProgressRepository.find.mockResolvedValue(evalResults);

      const results = await service.getEvaluationResults(userId);

      expect(userProgressRepository.find).toHaveBeenCalledWith({
        where: { user: { id: userId }, evaluation: { id: expect.any(Object) } },
        relations: ['evaluation', 'evaluation.module'],
      });
      expect(results).toEqual(evalResults);
    });
  });

  describe('getUserProgress', () => {
    it("devrait indiquer si l'utilisateur a complété la leçon spécifiée", async () => {
      const userId = 8,
        lessonId = 15;
      userProgressRepository.findOne.mockResolvedValue({
        completed: true,
      } as UserProgress);
      let result = await service.getUserProgress(userId, lessonId);
      expect(userProgressRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: userId }, lesson: { id: lessonId } },
      });
      expect(result).toBe(true);

      userProgressRepository.findOne.mockResolvedValue(undefined);
      result = await service.getUserProgress(userId, lessonId);
      expect(result).toBeUndefined();
    });
  });
});
