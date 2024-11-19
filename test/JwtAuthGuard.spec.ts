import { JwtAuthGuard } from '../src/common/guards/jwt.guard';
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should return the request from GqlExecutionContext', () => {
    const mockExecutionContext = {
      getContext: jest.fn(() => ({
        req: { headers: { authorization: 'Bearer token' } },
      })),
    };

    jest
      .spyOn(GqlExecutionContext, 'create')
      .mockReturnValue(mockExecutionContext as any);

    const context = {} as ExecutionContext;
    const result = guard.getRequest(context);

    expect(GqlExecutionContext.create).toHaveBeenCalledWith(context);
    expect(result).toEqual({ headers: { authorization: 'Bearer token' } });
  });
});
