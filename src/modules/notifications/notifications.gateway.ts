import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user-${userId}`);
      console.log(
        `Client ${client.id} connecté et joint à la room user-${userId}`,
      );
    } else {
      console.log(`Client ${client.id} connecté sans userId`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client ${client.id} déconnecté`);
  }

  sendNotification(userId: number, payload: any) {
    this.server.to(`user-${userId}`).emit('notification', payload);
  }
}
