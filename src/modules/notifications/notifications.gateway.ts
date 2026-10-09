import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket, Server } from 'socket.io';

const sessionTokenFrom = (cookieHeader?: string): string | null => {
  const cookie = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('token='));

  return cookie ? decodeURIComponent(cookie.slice('token='.length)) : null;
};

@WebSocketGateway({
  cors: {
    origin: [
      'https://staging.skycrew.fr',
      'https://skycrew.fr',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  // A client only ever joins its own room: the user comes from the session
  // cookie sent with the handshake, never from a value supplied by the client.
  handleConnection(client: Socket) {
    const userId = this.authenticate(client);

    if (!userId) {
      this.logger.debug(`Client ${client.id} refused: no valid session`);
      client.disconnect(true);
      return;
    }

    client.join(`user-${userId}`);
    this.logger.debug(`Client ${client.id} joined room user-${userId}`);
  }

  private authenticate(client: Socket): number | null {
    const token = sessionTokenFrom(client.handshake.headers?.cookie);
    const secret = process.env.JWT_SECRET;

    if (!token || !secret) {
      return null;
    }

    try {
      const payload = new JwtService({ secret }).verify(token);
      // Single-purpose tokens (two-factor challenge…) are not sessions.
      return payload.purpose ? null : (payload.sub ?? null);
    } catch {
      return null;
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendNotification(userId: number, payload: any) {
    if (!this.server) {
      this.logger.debug(
        `Skipping realtime notification for user-${userId}: gateway not initialized`,
      );
      return;
    }

    this.server.to(`user-${userId}`).emit('notification', payload);
  }
}
