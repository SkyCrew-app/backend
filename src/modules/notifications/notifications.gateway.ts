import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';

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

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user-${userId}`);
      this.logger.debug(`Client ${client.id} joined room user-${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendNotification(userId: number, payload: any) {
    this.server.to(`user-${userId}`).emit('notification', payload);
  }
}
