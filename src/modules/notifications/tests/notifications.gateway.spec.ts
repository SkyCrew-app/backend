import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from '../notifications.gateway';
import { Socket, Server } from 'socket.io';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let mockServer: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsGateway],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);

    // Mock du serveur WebSocket
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    // Mock du socket client
    mockSocket = {
      id: 'socket-123',
      handshake: {
        query: {},
      },
      join: jest.fn(),
    } as any;

    gateway.server = mockServer;

    // Mock console.log pour éviter les logs pendant les tests
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should join user room when userId is provided', () => {
      mockSocket.handshake.query.userId = '123';

      gateway.handleConnection(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('user-123');
      expect(console.log).toHaveBeenCalledWith(
        'Client socket-123 connecté et joint à la room user-123',
      );
    });

    it('should log connection without joining room when userId is not provided', () => {
      mockSocket.handshake.query.userId = undefined;

      gateway.handleConnection(mockSocket);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'Client socket-123 connecté sans userId',
      );
    });

    it('should handle empty string userId', () => {
      mockSocket.handshake.query.userId = '';

      gateway.handleConnection(mockSocket);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'Client socket-123 connecté sans userId',
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      gateway.handleDisconnect(mockSocket);

      expect(console.log).toHaveBeenCalledWith('Client socket-123 déconnecté');
    });
  });

  describe('sendNotification', () => {
    it('should send notification to specific user room', () => {
      const userId = 123;
      const payload = { message: 'Test notification', type: 'info' };

      gateway.sendNotification(userId, payload);

      expect(mockServer.to).toHaveBeenCalledWith('user-123');
      expect(mockServer.emit).toHaveBeenCalledWith('notification', payload);
    });

    it('should handle different payload types', () => {
      const userId = 456;
      const payload = {
        id: 1,
        message: 'Complex notification',
        data: { nested: 'value' },
        timestamp: new Date(),
      };

      gateway.sendNotification(userId, payload);

      expect(mockServer.to).toHaveBeenCalledWith('user-456');
      expect(mockServer.emit).toHaveBeenCalledWith('notification', payload);
    });
  });
});
