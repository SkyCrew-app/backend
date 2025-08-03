import { Test, TestingModule } from '@nestjs/testing';
import { AppResolver } from './app.resolver';

describe('AppResolver', () => {
  let resolver: AppResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppResolver],
    }).compile();

    resolver = module.get<AppResolver>(AppResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should return "Hello, World!" from hello query', () => {
    expect(resolver.hello()).toBe('Hello, World!');
  });

  it('should always return the same message', () => {
    const result1 = resolver.hello();
    const result2 = resolver.hello();

    expect(result1).toBe(result2);
  });

  it('should return a non-empty string', () => {
    const result = resolver.hello();

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
