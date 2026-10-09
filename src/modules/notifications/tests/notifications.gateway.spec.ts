import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from '../notifications.gateway';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

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
      disconnect: jest.fn(),
    } as any;

    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    const SECRET = 'gateway-test-secret';
    const sign = (payload: object, secret = SECRET) =>
      new JwtService({ secret }).sign(payload, { expiresIn: '5m' });
    const connectWith = (cookie?: string, query: object = {}) => {
      (mockSocket.handshake as any) = { query, headers: { cookie } };
      gateway.handleConnection(mockSocket);
    };

    beforeEach(() => {
      process.env.JWT_SECRET = SECRET;
    });

    it('joins the room of the user in the session cookie', () => {
      connectWith(`email=a%40b.c; token=${sign({ sub: 123, email: 'a@b.c' })}`);

      expect(mockSocket.join).toHaveBeenCalledWith('user-123');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('ignores a user id supplied by the client', () => {
      connectWith(`token=${sign({ sub: 123 })}`, { userId: '999' });

      expect(mockSocket.join).toHaveBeenCalledTimes(1);
      expect(mockSocket.join).toHaveBeenCalledWith('user-123');
    });

    it.each([
      ['no cookie', undefined],
      ['a cookie without token', 'email=a%40b.c'],
      ['a malformed token', 'token=not-a-jwt'],
      ['a token signed with another secret', `token=${'PLACEHOLDER'}`],
    ])('refuses and disconnects a client with %s', (label, cookie) => {
      const value =
        label === 'a token signed with another secret'
          ? `token=${sign({ sub: 123 }, 'another-secret')}`
          : cookie;

      connectWith(value, { userId: '123' });

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('refuses a single-purpose token such as the two-factor challenge', () => {
      connectWith(`token=${sign({ sub: 123, purpose: '2fa' })}`);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should handle client disconnection without error', () => {
      expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
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
