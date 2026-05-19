import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles Decorator', () => {
  it('devrait définir les métadonnées avec les rôles passés en argument', () => {
    // Création d'un décorateur avec deux rôles
    const decorator = Roles('admin', 'user');

    // On applique le décorateur sur une cible factice
    class TestClass {}
    decorator(TestClass, 'testMethod', undefined as any);

    // Vérification que SetMetadata a été appelé correctement
    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual(['admin', 'user']);
  });

  it('devrait fonctionner avec un seul rôle', () => {
    const decorator = Roles('guest');
    class TestClass {}
    decorator(TestClass, 'testMethod', undefined as any);
    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual(['guest']);
  });

  it("devrait définir un tableau vide si aucun rôle n'est passé", () => {
    const decorator = Roles();
    class TestClass {}
    decorator(TestClass, 'testMethod', undefined as any);
    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual([]);
  });
});
