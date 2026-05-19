import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications.module';
import { NotificationsService } from '../notifications.service';
import { NotificationsResolver } from '../notifications.resolver';
import { NotificationsGateway } from '../notifications.gateway';
import { Notification } from '../entity/notifications.entity';

describe('NotificationsModule', () => {
  let module: TestingModule;
  let service: NotificationsService;
  let resolver: NotificationsResolver;
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [NotificationsModule],
    })
      .overrideProvider(getRepositoryToken(Notification))
      .useValue({})
      .compile();

    service = module.get<NotificationsService>(NotificationsService);
    resolver = module.get<NotificationsResolver>(NotificationsResolver);
    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide NotificationsService', () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(NotificationsService);
  });

  it('should provide NotificationsResolver', () => {
    expect(resolver).toBeDefined();
    expect(resolver).toBeInstanceOf(NotificationsResolver);
  });

  it('should provide NotificationsGateway', () => {
    expect(gateway).toBeDefined();
    expect(gateway).toBeInstanceOf(NotificationsGateway);
  });

  it('should export NotificationsService', () => {
    const exportedService =
      module.get<NotificationsService>(NotificationsService);
    expect(exportedService).toBeDefined();
  });
});
