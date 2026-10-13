import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Socket, Server } from 'socket.io';
import { User } from '../users/entity/users.entity';
import { userOfSessionToken } from '../../common/auth/session';
import { corsOrigin } from '../../config/cors.config';

const sessionTokenFrom = (cookieHeader?: string): string | null => {
  const cookie = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('token='));

  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(cookie.slice('token='.length));
  } catch {
    return null;
  }
};

@WebSocketGateway({
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // A client only ever joins its own room: the user comes from the session
  // cookie sent with the handshake, never from a value supplied by the client.
  async handleConnection(client: Socket) {
    const userId = await this.authenticate(client);

    if (!userId) {
      this.logger.debug(`Client ${client.id} refused: no valid session`);
      client.disconnect(true);
      return;
    }

    client.join(`user-${userId}`);
    this.logger.debug(`Client ${client.id} joined room user-${userId}`);
  }

  // Same rule as the API: the token must be a session token of an existing
  // user, opened after the last password change.
  private async authenticate(client: Socket): Promise<number | null> {
    const user = await userOfSessionToken(
      sessionTokenFrom(client.handshake.headers?.cookie),
      (email) => this.usersRepository.findOne({ where: { email } }),
    );

    return user?.id ?? null;
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
