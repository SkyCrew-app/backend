import { UsersResolver } from '../users.resolver';
import { UsersService } from '../users.service';
import { UpdateUserInput } from '../dto/update-user.input';
import { UpdateUserPreferencesInput } from '../dto/update-user-preferences.input';
import { FileUpload } from 'graphql-upload-ts';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  let usersService: Partial<UsersService>;

  beforeEach(() => {
    // Créer un faux service UsersService avec des méthodes simulées
    usersService = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOneByEmail: jest.fn(),
      updateUser: jest.fn(),
      update2FAStatus: jest.fn(),
      updateNotificationSettings: jest.fn(),
      updatePassword: jest.fn(),
      findOneById: jest.fn(),
      confirmEmailAndSetPassword: jest.fn(),
      getUserPreferences: jest.fn(),
      updateUserPreferences: jest.fn(),
    };
    resolver = new UsersResolver(usersService as UsersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getUsers devrait retourner la liste des utilisateurs en appelant UsersService.findAll', async () => {
    const usersList = [{ id: 1 }, { id: 2 }];
    (usersService.findAll as jest.Mock).mockResolvedValue(usersList);

    const result = await resolver.getUsers();

    expect(usersService.findAll).toHaveBeenCalled();
    expect(result).toEqual(usersList);
  });

  it('createUser devrait appeler UsersService.create avec les bons paramètres', async () => {
    const createdUser = { id: 10, email: 'new@mail.com' };
    (usersService.create as jest.Mock).mockResolvedValue(createdUser);
    const firstName = 'Alan',
      lastName = 'Turing',
      email = 'alan.turing@example.com';
    const dob = new Date('1912-06-23');

    const result = await resolver.createUser(firstName, lastName, email, dob);

    expect(usersService.create).toHaveBeenCalledWith({
      first_name: firstName,
      last_name: lastName,
      email,
      date_of_birth: dob,
    });
    expect(result).toEqual(createdUser);
  });

  it('userByEmail devrait appeler UsersService.findOneByEmail et renvoyer le résultat', async () => {
    const user = { id: 5, email: 'test@mail.com' };
    (usersService.findOneByEmail as jest.Mock).mockResolvedValue(user);

    const result = await resolver.userByEmail('test@mail.com');

    expect(usersService.findOneByEmail).toHaveBeenCalledWith('test@mail.com');
    expect(result).toBe(user);
  });

  describe('updateUser mutation', () => {
    const updateInput: UpdateUserInput = {
      email: 'foo@bar.com',
      first_name: 'Foo',
      last_name: 'Bar',
    };

    it("devrait appeler UsersService.updateUser avec imagePath = null si aucune image n'est fournie", async () => {
      const updatedUser = { id: 1, first_name: 'Foo', last_name: 'Bar' };
      (usersService.updateUser as jest.Mock).mockResolvedValue(updatedUser);

      const result = await resolver.updateUser(updateInput, undefined);

      expect(usersService.updateUser).toHaveBeenCalledWith(updateInput, null);
      expect(result).toBe(updatedUser);
    });

    it("devrait sauvegarder l'image sur le disque et appeler UsersService.updateUser avec le bon chemin si une image est fournie", async () => {
      const updatedUser = {
        id: 2,
        profile_picture: '/uploads/users/2/myfile.txt',
      };
      (usersService.updateUser as jest.Mock).mockResolvedValue(updatedUser);

      const fileStream = {
        pipe: jest.fn((dest) => {
          dest.end();
          return dest;
        }),
      };
      const file: Partial<FileUpload> = {
        createReadStream: jest.fn(() => fileStream as any),
        filename: 'myfile.txt',
      };
      const fileUploadPromise = Promise.resolve(file as FileUpload);

      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

      const dummyWriteStream: any = new EventEmitter();
      dummyWriteStream.write = jest.fn();
      dummyWriteStream.end = jest.fn(function () {
        process.nextTick(() => dummyWriteStream.emit('finish'));
      });
      jest
        .spyOn(fs, 'createWriteStream')
        .mockReturnValue(dummyWriteStream as any);

      const result = await resolver.updateUser(
        updateInput,
        await fileUploadPromise,
      );

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(__dirname, '../../../uploads/tmp'),
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(__dirname, '../../../uploads/tmp'),
        { recursive: true },
      );
      expect(usersService.updateUser).toHaveBeenCalledWith(
        updateInput,
        expect.stringContaining('myfile.txt'),
      );
      expect(result).toBe(updatedUser);
    });
  });

  it('toggle2FA devrait mettre à jour le statut 2FA via UsersService.update2FAStatus', async () => {
    const user = { id: 3, is2FAEnabled: true };
    (usersService.update2FAStatus as jest.Mock).mockResolvedValue(user);

    const result = await resolver.toggle2FA('user@mail.com', true);

    expect(usersService.update2FAStatus).toHaveBeenCalledWith(
      'user@mail.com',
      true,
    );
    expect(result).toBe(user);
  });

  it('updateNotificationSettings devrait appeler UsersService.updateNotificationSettings avec le bon userId issu du contexte', async () => {
    const updatedUser = {
      id: 4,
      email_notifications_enabled: true,
      sms_notifications_enabled: false,
      newsletter_subscribed: true,
    };
    (usersService.updateNotificationSettings as jest.Mock).mockResolvedValue(
      updatedUser,
    );
    // Contexte factice avec utilisateur connecté
    const context = { req: { user: { id: 4, email: 'test@x.com' } } };

    const result = await resolver.updateNotificationSettings(
      true,
      false,
      true,
      context,
    );

    expect(usersService.updateNotificationSettings).toHaveBeenCalledWith(
      4,
      true,
      false,
      true,
    );
    expect(result).toBe(updatedUser);
  });

  it('updatePassword devrait appeler UsersService.updatePassword avec le bon userId du contexte', async () => {
    const userAfterPasswordChange = { id: 5, email: 'u@u.com' };
    (usersService.updatePassword as jest.Mock).mockResolvedValue(
      userAfterPasswordChange,
    );
    const context = { req: { user: { id: 5 } } };

    const result = await resolver.updatePassword('oldPass', 'newPass', context);

    expect(usersService.updatePassword).toHaveBeenCalledWith(
      5,
      'oldPass',
      'newPass',
    );
    expect(result).toBe(userAfterPasswordChange);
  });

  it('getUserDetails devrait récupérer un utilisateur par ID via UsersService.findOneById', async () => {
    const user = { id: 6, email: 'foo@bar.com' };
    (usersService.findOneById as jest.Mock).mockResolvedValue(user);

    const result = await resolver.getUserDetails(6);

    expect(usersService.findOneById).toHaveBeenCalledWith(6);
    expect(result).toBe(user);
  });

  it('confirmEmailAndSetPassword devrait appeler UsersService.confirmEmailAndSetPassword avec le token et mot de passe', async () => {
    const user = { id: 7, email: 'test@test.com', isEmailConfirmed: true };
    (usersService.confirmEmailAndSetPassword as jest.Mock).mockResolvedValue(
      user,
    );

    const result = await resolver.confirmEmailAndSetPassword(
      'token123',
      'Pass!',
    );

    expect(usersService.confirmEmailAndSetPassword).toHaveBeenCalledWith(
      'token123',
      'Pass!',
    );
    expect(result).toBe(user);
  });

  it('getUserPreferences devrait récupérer les préférences via UsersService.getUserPreferences', async () => {
    const user = { id: 8, language: 'fr' };
    (usersService.getUserPreferences as jest.Mock).mockResolvedValue(user);

    const result = await resolver.getUserPreferences(8);

    expect(usersService.getUserPreferences).toHaveBeenCalledWith(8);
    expect(result).toBe(user);
  });

  it('updateUserPreferences devrait appeler UsersService.updateUserPreferences avec les bonnes valeurs', async () => {
    const updatedUser = { id: 9, language: 'en', preferred_aerodrome: 'XYZ' };
    (usersService.updateUserPreferences as jest.Mock).mockResolvedValue(
      updatedUser,
    );
    const prefsInput: UpdateUserPreferencesInput = {
      language: 'en',
      speed_unit: 'mph',
      distance_unit: 'mi',
      timezone: 'UTC',
      preferred_aerodrome: 'XYZ',
    };

    const result = await resolver.updateUserPreferences(9, prefsInput);

    expect(usersService.updateUserPreferences).toHaveBeenCalledWith(
      9,
      prefsInput.language,
      prefsInput.speed_unit,
      prefsInput.distance_unit,
      prefsInput.timezone,
      prefsInput.preferred_aerodrome,
    );
    expect(result).toBe(updatedUser);
  });

  describe('me (Query)', () => {
    it("devrait renvoyer l'id et l'email de l'utilisateur authentifié présent dans le contexte", () => {
      const context = { req: { user: { id: 12, email: 'user@dom.com' } } };

      const result = resolver.me(context);

      expect(result).toEqual({ id: 12, email: 'user@dom.com' });
    });

    it("devrait lever une erreur si aucun utilisateur n'est présent dans le contexte (non authentifié)", () => {
      const context = { req: {} };
      expect(() => resolver.me(context)).toThrow('Utilisateur non authentifié');
    });
  });
});
