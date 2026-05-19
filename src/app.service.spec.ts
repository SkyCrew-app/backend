import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return "Hello World!" from getHello', () => {
    expect(service.getHello()).toBe('Hello World!');
  });

  it('should always return the same message', () => {
    expect(service.getHello()).toBe(service.getHello());
  });

  it('should return a non-empty string', () => {
    const result = service.getHello();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
