import { JwtAuthGuard } from './jwt.guard';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ExecutionContext } from '@nestjs/common';

// Mock du contexte GraphQL
jest.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockGqlCtx: any;
  let executionContext: ExecutionContext;
  const fakeReq = {
    headers: { authorization: 'Bearer token' },
    user: { id: 1 },
  };

  beforeEach(() => {
    guard = new JwtAuthGuard();
    // Simulation du contexte GraphQL renvoyant { req: fakeReq }
    mockGqlCtx = { getContext: () => ({ req: fakeReq }) };
    (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlCtx);
    executionContext = {} as ExecutionContext;
  });

  it('devrait être défini', () => {
    expect(guard).toBeDefined();
  });

  describe('getRequest', () => {
    it("devrait retourner l'objet request depuis le contexte GraphQL", () => {
      const result = guard.getRequest(executionContext);
      expect(GqlExecutionContext.create).toHaveBeenCalledWith(executionContext);
      expect(result).toBe(fakeReq);
    });

    it('devrait retourner undefined si aucun request trouvé', () => {
      // Simulation d'un contexte sans req
      (GqlExecutionContext.create as jest.Mock).mockReturnValue({
        getContext: () => ({}),
      });
      const result = guard.getRequest(executionContext);
      expect(result).toBeUndefined();
    });
  });
});
