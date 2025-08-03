import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

// Mock GqlExecutionContext.create
jest.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Partial<Reflector>;
  let executionContext: ExecutionContext;
  const getContextMock = jest.fn();

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector as Reflector);

    executionContext = {
      getHandler: () => 'handler',
      getClass: () => 'class',
    } as unknown as ExecutionContext;

    (GqlExecutionContext.create as jest.Mock).mockReturnValue({
      getContext: getContextMock,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('devrait permettre si aucun rôle requis', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(executionContext)).toBe(true);
  });

  it('devrait permettre si tableau de rôles requis vide', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);
    expect(guard.canActivate(executionContext)).toBe(true);
  });

  it("devrait refuser si pas d'utilisateur", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['admin']);
    getContextMock.mockReturnValue({ req: {} });
    expect(guard.canActivate(executionContext)).toBe(false);
  });

  it('devrait refuser si utilisateur sans rôle', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['admin']);
    getContextMock.mockReturnValue({ req: { user: {} } });
    expect(guard.canActivate(executionContext)).toBe(false);
  });

  it('devrait permettre si rôle utilisateur présent', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'admin',
      'user',
    ]);
    getContextMock.mockReturnValue({ req: { user: { role: 'user' } } });
    expect(guard.canActivate(executionContext)).toBe(true);
  });

  it('devrait permettre si rôle utilisateur via objet rôle', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['admin']);
    getContextMock.mockReturnValue({
      req: { user: { role: { role_name: 'admin' } } },
    });
    expect(guard.canActivate(executionContext)).toBe(true);
  });

  it('devrait refuser si rôle utilisateur non autorisé', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['admin']);
    getContextMock.mockReturnValue({ req: { user: { role: 'guest' } } });
    expect(guard.canActivate(executionContext)).toBe(false);
  });
});
