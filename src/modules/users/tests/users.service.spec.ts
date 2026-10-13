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
import { PASSWORD_MIN_LENGTH, UsersService } from '../users.service';
import { User } from '../entity/users.entity';
import { UserProgress } from '../entity/user-progress.entity';
import { Lesson } from '../../e-learning/entity/lesson.entity';
import { MailerService } from '../../mail/mailer.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { Notification } from '../../notifications/entity/notifications.entity';

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

    it('finds the member whatever the case the address is typed in', async () => {
      const user = { id: 2, email: 'test@example.com' } as User;
      // No row with this exact spelling, one once the case is ignored.
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(user);

      const result = await service.findOneByEmail('  Test@Example.COM ');

      expect(result).toBe(user);
      const { where } = userRepository.findOne.mock.calls[1][0];
      expect(where.email.getSql('"email"')).toBe('LOWER("email") = :email');
      expect(where.email.objectLiteralParameters).toEqual({
        email: 'test@example.com',
      });
    });

    it('never looks an empty address up', async () => {
      await expect(service.findOneByEmail('')).resolves.toBeNull();
      expect(userRepository.findOne).not.toHaveBeenCalled();
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
      const roleLookup = jest
        .fn()
        .mockResolvedValue({ id: 2, role_name: 'Pilote' });
      (userRepository as any).manager = {
        getRepository: () => ({ findOne: roleLookup }),
      };

      const result = await service.create(newUserData);

      // A new member is never an administrator by default.
      expect(roleLookup).toHaveBeenCalledWith({
        where: { role_name: 'Pilote' },
      });
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: { id: 2, role_name: 'Pilote' } }),
      );

      expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 10);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          role: { id: 2, role_name: 'Pilote' },
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
        'fr',
      );
      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toEqual(savedUser);
    });

    const withPilotRole = () => {
      (userRepository as any).manager = {
        getRepository: () => ({
          findOne: jest.fn().mockResolvedValue({ id: 2, role_name: 'Pilote' }),
        }),
      };
      userRepository.create.mockImplementation((data) => data);
      userRepository.save.mockImplementation(async (data) => data);
      (uuidv4 as jest.Mock).mockReturnValue('some-uuid');
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword' as never);
    };

    it('stores the address in lower case, with an invitation that expires', async () => {
      withPilotRole();

      const created = await service.create({
        first_name: 'John',
        last_name: 'Doe',
        email: '  John.Doe@Example.COM ',
        date_of_birth: new Date('2000-01-01'),
      });

      expect(created.email).toBe('john.doe@example.com');
      const validity = created.validationTokenExpiresAt.getTime() - Date.now();
      expect(validity).toBeGreaterThan(6 * 24 * 3600_000);
      expect(validity).toBeLessThanOrEqual(7 * 24 * 3600_000);
    });

    it('refuses an address already used in another case, before any e-mail', async () => {
      withPilotRole();
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 9, email: 'john.doe@example.com' });

      await expect(
        service.create({ first_name: 'J', email: 'John.Doe@example.com' }),
      ).rejects.toThrow('Un compte existe déjà avec cette adresse e-mail');
      expect(mailerService.sendMail).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('refuses what is not an e-mail address', async () => {
      withPilotRole();

      await expect(
        service.create({ first_name: 'J', email: 'not-an-address' }),
      ).rejects.toThrow("Cette adresse e-mail n'est pas valide");
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('resendInvitation', () => {
    it('sends a new link and replaces the previous one', async () => {
      const user = {
        id: 5,
        email: 'new@example.com',
        first_name: 'New',
        isEmailConfirmed: false,
        validation_token: 'old-token',
        validationTokenExpiresAt: new Date('2020-01-01'),
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (saved) => saved);
      (uuidv4 as jest.Mock).mockReturnValue('new-token');

      await expect(service.resendInvitation(5)).resolves.toBe(true);

      expect(user.validation_token).toBe('new-token');
      expect(user.validationTokenExpiresAt.getTime()).toBeGreaterThan(
        Date.now(),
      );
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        'new@example.com',
        expect.any(String),
        expect.any(String),
        'confirmation-email',
        {
          name: 'New',
          confirmationUrl:
            'http://frontend.test/auth/new-account?token=new-token',
        },
        'fr',
      );
    });

    it('refuses for a member who already activated their account', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 5,
        isEmailConfirmed: true,
      });

      await expect(service.resendInvitation(5)).rejects.toThrow(
        'Ce membre a déjà activé son compte',
      );
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('set2FASecret', () => {
    it('devrait enregistrer le secret en attente sans activer la 2FA ni notifier', async () => {
      const user = {
        id: 10,
        email: 'twofa@example.com',
        first_name: 'Jean',
        twoFactorAuthSecret: 'ACTIF',
        twoFactorAuthPendingSecret: null,
      } as User;
      userRepository.findOne.mockResolvedValue(user);

      await service.set2FASecret('twofa@example.com', 'SECRET123');

      expect(user.twoFactorAuthPendingSecret).toBe('SECRET123');
      expect(user.twoFactorAuthSecret).toBe('ACTIF');
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(mailerService.sendMail).not.toHaveBeenCalled();
      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it("devrait lever une erreur si l'utilisateur n'existe pas", async () => {
      userRepository.findOne.mockResolvedValue(undefined);

      await expect(
        service.set2FASecret('unknown@example.com', 'SECRET123'),
      ).rejects.toThrow('User not found');
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('activate2FA', () => {
    it('devrait activer le secret en attente, envoyer un email et créer une notification', async () => {
      const user = {
        id: 10,
        email: 'twofa@example.com',
        first_name: 'Jean',
        is2FAEnabled: false,
        twoFactorAuthSecret: null,
        twoFactorAuthPendingSecret: 'SECRET123',
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);
      (mailerService.sendMail as jest.Mock).mockResolvedValue(true);

      await service.activate2FA('twofa@example.com');

      expect(user.twoFactorAuthSecret).toBe('SECRET123');
      expect(user.twoFactorAuthPendingSecret).toBeNull();
      expect(user.is2FAEnabled).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        'twofa@example.com',
        'Authentification à deux facteurs activée',
        expect.any(String),
        '2fa-enabled',
        { name: 'Jean' },
        'fr',
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 10,
          notification_type: '2FA_ENABLED',
          message: 'Authentification à deux facteurs activée',
        }),
      );
    });

    it("devrait confirmer l'activation même si l'email ne part pas", async () => {
      const user = {
        id: 10,
        email: 'twofa@example.com',
        first_name: 'Jean',
        is2FAEnabled: false,
        twoFactorAuthPendingSecret: 'SECRET123',
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);
      (mailerService.sendMail as jest.Mock).mockRejectedValue(
        new Error('SMTP indisponible'),
      );

      await expect(service.activate2FA('twofa@example.com')).resolves.toBe(
        user,
      );
      expect(user.twoFactorAuthSecret).toBe('SECRET123');
      expect(user.is2FAEnabled).toBe(true);
    });

    it("devrait refuser s'il n'y a aucun secret en attente", async () => {
      userRepository.findOne.mockResolvedValue({
        id: 10,
        twoFactorAuthPendingSecret: null,
      } as User);

      await expect(service.activate2FA('twofa@example.com')).rejects.toThrow(
        'No two-factor secret is waiting for confirmation',
      );
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(mailerService.sendMail).not.toHaveBeenCalled();
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
      userRepository.findOne.mockResolvedValue(existingUser);
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
      const updatedUser = await service.updateUser(
        'update@example.com',
        updateInput,
        null,
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        existingUser.email,
        'Vos informations ont été mises à jour',
        expect.any(String),
        'update-user',
        { name: 'NewName' },
        'fr',
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
      await service.updateUser('update@example.com', updateInput, imagePath);
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

  describe('updateUser, champs autorisés', () => {
    const mockFilesystem = () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    };

    const admins = (others: number) => {
      userRepository.count.mockResolvedValue(others);
    };
    const withRoles = (...roles: { id: number; role_name: string }[]) => {
      (userRepository as any).manager = {
        getRepository: () => ({
          findOne: jest.fn(
            async ({ where }) =>
              roles.find((role) => role.id === where.id) ?? null,
          ),
        }),
      };
    };

    it("ne laisse pas l'intéressé changer son mot de passe ni son rôle", async () => {
      mockFilesystem();
      const user = {
        id: 3,
        email: 'pilot@example.com',
        first_name: 'Old',
        password: 'hash-existant',
        role: { id: 2 },
      } as any;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u);

      await service.updateUser(
        'pilot@example.com',
        {
          first_name: 'New',
          password: 'pirate',
          roleId: 1,
          profile_picture: '/uploads/users/1/autre.png',
        } as any,
        null,
      );

      expect(user.first_name).toBe('New');
      expect(user.password).toBe('hash-existant');
      expect(user.role).toEqual({ id: 2 });
      expect(user.profile_picture).toBeUndefined();
      expect(user.id).toBe(3);
    });

    it('refuse un identifiant qui ne correspond pas au compte visé', async () => {
      mockFilesystem();
      userRepository.findOne.mockResolvedValue({ id: 3 } as any);

      await expect(
        service.updateUser('pilot@example.com', { id: 999 } as any, null),
      ).rejects.toThrow('The id does not match the account being updated');
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('laisse un administrateur changer le rôle, mais jamais le mot de passe', async () => {
      mockFilesystem();
      const user = {
        id: 3,
        email: 'pilot@example.com',
        password: 'hash-existant',
        role: { id: 2, role_name: 'Pilote' },
      } as any;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u);
      withRoles({ id: 4, role_name: 'Instructeur' });

      await service.updateUser(
        'pilot@example.com',
        { password: 'pirate', roleId: 4 } as any,
        null,
        { asAdmin: true },
      );

      expect(user.role).toEqual({ id: 4, role_name: 'Instructeur' });
      expect(user.password).toBe('hash-existant');
    });

    it("refuse un rôle qui n'existe pas", async () => {
      mockFilesystem();
      userRepository.findOne.mockResolvedValue({
        id: 3,
        role: { id: 2, role_name: 'Pilote' },
      } as any);
      withRoles();

      await expect(
        service.updateUser('pilot@example.com', { roleId: 77 } as any, null, {
          asAdmin: true,
        }),
      ).rejects.toThrow('Rôle introuvable');
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('refuse de retirer son rôle au dernier administrateur actif', async () => {
      mockFilesystem();
      const user = {
        id: 1,
        email: 'admin@example.com',
        is_active: true,
        isEmailConfirmed: true,
        role: { id: 1, role_name: 'Administrateur' },
      } as any;
      userRepository.findOne.mockResolvedValue(user);
      withRoles({ id: 2, role_name: 'Pilote' });
      admins(0);

      await expect(
        service.updateUser('admin@example.com', { roleId: 2 } as any, null, {
          asAdmin: true,
        }),
      ).rejects.toThrow(
        'Le club doit garder au moins un administrateur actif : ce compte est le dernier.',
      );
      expect(user.role.role_name).toBe('Administrateur');
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it("laisse rétrograder un administrateur tant qu'il en reste un autre", async () => {
      mockFilesystem();
      const user = {
        id: 1,
        email: 'admin@example.com',
        is_active: true,
        isEmailConfirmed: true,
        role: { id: 1, role_name: 'Administrateur' },
      } as any;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u);
      withRoles({ id: 2, role_name: 'Pilote' });
      admins(1);

      await service.updateUser(
        'admin@example.com',
        { roleId: 2 } as any,
        null,
        {
          asAdmin: true,
        },
      );

      expect(user.role.role_name).toBe('Pilote');
    });

    it("cible le compte demandé par l'appelant, pas l'email du formulaire", async () => {
      mockFilesystem();
      userRepository.findOne.mockResolvedValue({ id: 3 } as any);
      userRepository.save.mockImplementation(async (u) => u);

      await service.updateUser(
        'pilot@example.com',
        { email: 'victim@example.com', first_name: 'X' } as any,
        null,
      );

      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'pilot@example.com' } }),
      );
      expect(userRepository.findOne).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'victim@example.com' } }),
      );
    });
  });

  describe('setActive', () => {
    const member = (overrides: Partial<User> = {}) =>
      ({
        id: 7,
        is_active: true,
        isEmailConfirmed: true,
        sessionVersion: 4,
        passwordResetTokenHash: 'pending-reset',
        role: { id: 2, role_name: 'Pilote' },
        ...overrides,
      }) as User;

    beforeEach(() => {
      userRepository.save.mockImplementation(async (saved) => saved);
    });

    it('deactivates the member and ends their sessions', async () => {
      const user = member();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.setActive(7, false);

      expect(result.is_active).toBe(false);
      expect(result.sessionVersion).toBe(5);
      expect(result.passwordResetTokenHash).toBeNull();
    });

    it('reactivates the member', async () => {
      const user = member({ is_active: false });
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.setActive(7, true);

      expect(result.is_active).toBe(true);
    });

    it('refuses to deactivate the last active administrator', async () => {
      const user = member({
        role: { id: 1, role_name: 'Administrateur' } as any,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.count.mockResolvedValue(0);

      await expect(service.setActive(7, false)).rejects.toThrow(
        'Le club doit garder au moins un administrateur actif',
      );
      expect(user.is_active).toBe(true);
      expect(userRepository.save).not.toHaveBeenCalled();
      // Only administrators able to sign in count as "another one".
      expect(userRepository.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          is_active: true,
          isEmailConfirmed: true,
          role: { role_name: 'Administrateur' },
        }),
      });
    });

    it('deactivates an administrator when another one remains', async () => {
      const user = member({
        role: { id: 1, role_name: 'Administrateur' } as any,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.count.mockResolvedValue(1);

      await expect(service.setActive(7, false)).resolves.toMatchObject({
        is_active: false,
      });
    });

    it('answers "not found" for an unknown member', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.setActive(99, false)).rejects.toThrow(
        'Membre introuvable',
      );
    });
  });

  describe('remove', () => {
    class Booking {}
    const deleted: unknown[] = [];
    let rowsOf: Map<unknown, number>;

    // The database as the service walks it: every entity pointing to a member.
    const withDatabase = () => {
      const relationTo = (target: unknown, propertyName: string) => ({
        propertyName,
        inverseEntityMetadata: { target },
      });
      const metadatas = [
        { target: Booking, manyToOneRelations: [relationTo(User, 'user')] },
        {
          target: Notification,
          manyToOneRelations: [relationTo(User, 'user')],
        },
        { target: User, manyToOneRelations: [relationTo(Object, 'role')] },
      ];
      const queryBuilder: any = {
        delete: () => queryBuilder,
        from: (entity: unknown) => {
          deleted.push(entity);
          return queryBuilder;
        },
        where: () => queryBuilder,
        execute: jest.fn(),
      };
      const transactionManager = {
        createQueryBuilder: () => queryBuilder,
        getRepository: (entity: unknown) => ({
          delete: jest.fn(async () => deleted.push(entity)),
        }),
      };
      (userRepository as any).manager = {
        connection: { entityMetadatas: metadatas },
        getRepository: (entity: unknown) => ({
          count: jest.fn(async () => rowsOf.get(entity) ?? 0),
        }),
        transaction: jest.fn(async (work) => work(transactionManager)),
      };
    };

    beforeEach(() => {
      deleted.length = 0;
      rowsOf = new Map();
      withDatabase();
      userRepository.findOne.mockResolvedValue({
        id: 7,
        is_active: true,
        isEmailConfirmed: true,
        role: { id: 2, role_name: 'Pilote' },
      });
    });

    it('deletes an account without history, with its notifications', async () => {
      rowsOf.set(Notification, 3);

      await expect(service.remove(7)).resolves.toBe(true);

      expect(deleted).toContain(Notification);
      expect(deleted).toContain(User);
    });

    it('refuses a member with history and points to deactivation', async () => {
      rowsOf.set(Booking, 1);

      await expect(service.remove(7)).rejects.toThrow(
        'il ne peut pas être supprimé. Désactivez son compte à la place.',
      );
      expect(deleted).toEqual([]);
    });

    it('gives the same answer when the database itself refuses', async () => {
      (userRepository as any).manager.transaction.mockRejectedValue({
        code: '23503',
      });

      await expect(service.remove(7)).rejects.toThrow(
        'Désactivez son compte à la place.',
      );
    });

    it('refuses to delete the last active administrator', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        is_active: true,
        isEmailConfirmed: true,
        role: { id: 1, role_name: 'Administrateur' },
      });
      userRepository.count.mockResolvedValue(0);

      await expect(service.remove(1)).rejects.toThrow(
        'Le club doit garder au moins un administrateur actif',
      );
      expect(deleted).toEqual([]);
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

    it("devrait refuser d'activer la 2FA sans secret confirmé", async () => {
      const user = {
        id: 11,
        email: 'foo@bar.com',
        is2FAEnabled: false,
        twoFactorAuthSecret: null,
      } as User;
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.update2FAStatus('foo@bar.com', true),
      ).rejects.toThrow('Two-factor authentication has not been set up');
      expect(user.is2FAEnabled).toBe(false);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('devrait effacer les secrets quand la 2FA est désactivée', async () => {
      const user = {
        id: 11,
        email: 'foo@bar.com',
        is2FAEnabled: true,
        twoFactorAuthSecret: 'ACTIF',
        twoFactorAuthPendingSecret: 'EN_ATTENTE',
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await service.update2FAStatus('foo@bar.com', false);

      expect(user.is2FAEnabled).toBe(false);
      expect(user.twoFactorAuthSecret).toBeNull();
      expect(user.twoFactorAuthPendingSecret).toBeNull();
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(mailerService.sendMail).not.toHaveBeenCalled();
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
        service.updatePassword(30, 'wrongPassword', 'newPassword!'),
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
        { name: 'Demo' },
        'fr',
      );
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result.password).toBe('newHashedPassword');
    });

    it('refuses a new password shorter than the rule, even with the right current one', async () => {
      const user = { id: 31, password: 'hashedOldPassword' } as User;
      userRepository.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      const tooShort = 'x'.repeat(PASSWORD_MIN_LENGTH - 1);

      await expect(
        service.updatePassword(31, 'correctPassword', tooShort),
      ).rejects.toThrow(
        `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`,
      );
      expect(user.password).toBe('hashedOldPassword');
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('confirmEmailAndSetPassword', () => {
    const INVALID_INVITATION = "Ce lien d'activation est invalide ou a expiré";
    const soon = () => new Date(Date.now() + 3600_000);

    it("devrait lever une erreur si aucun utilisateur n'a le token fourni", async () => {
      userRepository.findOne.mockResolvedValue(undefined);
      await expect(
        service.confirmEmailAndSetPassword('invalid-token', 'Pass1234'),
      ).rejects.toThrow(INVALID_INVITATION);
    });

    it('refuses a link past its expiry, with the same answer', async () => {
      const user = {
        id: 40,
        validation_token: 'valid-token',
        validationTokenExpiresAt: new Date(Date.now() - 1000),
        isEmailConfirmed: false,
      } as User;
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.confirmEmailAndSetPassword('valid-token', 'NewPass!'),
      ).rejects.toThrow(INVALID_INVITATION);
      expect(user.isEmailConfirmed).toBe(false);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('refuses a link without expiry', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 40,
        validation_token: 'valid-token',
      });

      await expect(
        service.confirmEmailAndSetPassword('valid-token', 'NewPass!'),
      ).rejects.toThrow(INVALID_INVITATION);
    });

    it('refuses a password shorter than the rule and keeps the link usable', async () => {
      const user = {
        id: 40,
        validation_token: 'valid-token',
        validationTokenExpiresAt: soon(),
        isEmailConfirmed: false,
      } as User;
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.confirmEmailAndSetPassword('valid-token', ''),
      ).rejects.toThrow('Le mot de passe doit contenir au moins');
      await expect(
        service.confirmEmailAndSetPassword(
          'valid-token',
          'x'.repeat(PASSWORD_MIN_LENGTH - 1),
        ),
      ).rejects.toThrow('Le mot de passe doit contenir au moins');
      expect(user.validation_token).toBe('valid-token');
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('works once: the link and its expiry are cleared', async () => {
      const user = {
        id: 40,
        validation_token: 'valid-token',
        validationTokenExpiresAt: soon(),
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (saved: User) => saved);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedNewPass' as never);

      await service.confirmEmailAndSetPassword('valid-token', 'NewPass!');

      expect(user.validation_token).toBeNull();
      expect(user.validationTokenExpiresAt).toBeNull();
    });

    it("devrait confirmer l'email, définir le mot de passe et renvoyer l'utilisateur mis à jour", async () => {
      const user = {
        id: 40,
        validation_token: 'valid-token',
        validationTokenExpiresAt: soon(),
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

    it('closes the sessions opened before the activation', async () => {
      const user = {
        id: 41,
        validation_token: 'valid-token',
        validationTokenExpiresAt: soon(),
        sessionVersion: 2,
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedNewPass' as never);
      userRepository.save.mockImplementation(async (saved: User) => saved);

      const result = await service.confirmEmailAndSetPassword(
        'valid-token',
        'NewPass!',
      );

      expect(result.sessionVersion).toBe(3);
      expect(result.password).toBe('hashedNewPass');
    });

    it('starts the session version when the account never had one', async () => {
      const user = {
        id: 42,
        validation_token: 'valid-token',
        validationTokenExpiresAt: soon(),
      } as User;
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (saved: User) => saved);

      await service.confirmEmailAndSetPassword('valid-token', 'NewPass!');

      expect(user.sessionVersion).toBe(1);
    });

    it('never looks an empty token up', async () => {
      userRepository.findOne.mockClear();

      await expect(
        service.confirmEmailAndSetPassword('', 'NewPass!'),
      ).rejects.toThrow(INVALID_INVITATION);
      await expect(
        service.confirmEmailAndSetPassword(undefined, 'NewPass!'),
      ).rejects.toThrow(INVALID_INVITATION);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('offers no way to store a password that is not hashed', () => {
      expect((service as any).setPassword).toBeUndefined();
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
      expect(userProgressRepository.save).not.toHaveBeenCalled();
    });

    it("crée la progression quand la leçon n'avait pas été marquée comme commencée", async () => {
      userProgressRepository.update.mockResolvedValue({ affected: 0 } as any);
      userProgressRepository.create.mockImplementation((value) => value);

      await service.markLessonCompleted(2, 3);

      expect(userProgressRepository.save).toHaveBeenCalledWith({
        user: { id: 2 },
        lesson: { id: 3 },
        completed: true,
        completed_at: expect.any(Date),
      });
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

      userProgressRepository.findOne.mockResolvedValue({
        completed: false,
      } as UserProgress);
      result = await service.getUserProgress(userId, lessonId);
      expect(result).toBe(false);
    });

    it('répond non pour une leçon jamais ouverte, sans ligne de progression', async () => {
      userProgressRepository.findOne.mockResolvedValue(undefined);

      await expect(service.getUserProgress(8, 15)).resolves.toBe(false);
    });
  });

  describe('countCompletedLessons', () => {
    it('compte les leçons terminées, pas les évaluations', async () => {
      userProgressRepository.count = jest.fn().mockResolvedValue(4);

      await expect(service.countCompletedLessons(8)).resolves.toBe(4);
      expect(userProgressRepository.count).toHaveBeenCalledWith({
        where: {
          user: { id: 8 },
          lesson: { id: expect.anything() },
          completed: true,
        },
      });
    });
  });
});
