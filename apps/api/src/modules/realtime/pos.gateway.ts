import { Injectable, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { CartDTO, PosRealtimeEvent, SaleDTO } from "@ixoris/types";

/**
 * Backbone of the "vente croisée multi-appareils" requirement: a cart started
 * on one device (phone) and finalized on another (till) stays in sync because
 * every device in the same store room receives cart/sale events immediately.
 * A single Nest instance keeps state in-process; scale-out needs the Redis
 * adapter (@socket.io/redis-adapter) wired here so rooms fan out across pods.
 */
@Injectable()
@WebSocketGateway({ namespace: "/pos", cors: { origin: process.env.CORS_ORIGIN?.split(",") ?? "*" } })
export class PosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PosGateway.name);

  @WebSocketServer()
  private server!: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join:store")
  onJoinStore(@ConnectedSocket() client: Socket, @MessageBody() payload: { storeId: string }) {
    client.join(this.storeRoom(payload.storeId));
    return { ok: true };
  }

  @SubscribeMessage("leave:store")
  onLeaveStore(@ConnectedSocket() client: Socket, @MessageBody() payload: { storeId: string }) {
    client.leave(this.storeRoom(payload.storeId));
    return { ok: true };
  }

  emitCartUpdated(cart: CartDTO) {
    this.emit(cart.storeId, { type: "cart:updated", cart });
  }

  emitSaleCompleted(sale: SaleDTO) {
    this.emit(sale.storeId, { type: "sale:completed", sale });
  }

  private emit(storeId: string, event: PosRealtimeEvent) {
    this.server.to(this.storeRoom(storeId)).emit(event.type, event);
  }

  private storeRoom(storeId: string) {
    return `store:${storeId}`;
  }
}
