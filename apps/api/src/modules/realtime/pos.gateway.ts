import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { CartDTO, PosRealtimeEvent, SaleDTO } from "@ixoris/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessTokenPayload } from "../auth/auth.types";
import { corsOrigin } from "../../common/cors-origin";

interface AuthedSocket {
  userId: string;
  companyId: string;
}

/**
 * Backbone of the "vente croisée multi-appareils" requirement: a cart started
 * on one device (phone) and finalized on another (till) stays in sync because
 * every device in the same store room receives cart/sale events immediately.
 * A single Nest instance keeps state in-process; scale-out needs the Redis
 * adapter (@socket.io/redis-adapter) wired here so rooms fan out across pods.
 */
@Injectable()
@WebSocketGateway({ namespace: "/pos", cors: { origin: corsOrigin() } })
export class PosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PosGateway.name);
  /** Keyed by socket.id — Socket.IO has no first-class per-connection auth store, so we track it ourselves. */
  private readonly authedSockets = new Map<string, AuthedSocket>();

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * The same bearer JWT used for the REST API must be presented at connect
   * time (client sends it as `io(url, { auth: { token } })`). Without this,
   * any unauthenticated client could open a socket, join any store's room by
   * guessing its id — including a store belonging to a different company —
   * and silently receive live cart contents and completed-sale totals.
   */
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Rejected socket ${client.id}: no token presented`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (!payload.companyId) throw new UnauthorizedException();
      this.authedSockets.set(client.id, { userId: payload.sub, companyId: payload.companyId });
      this.logger.debug(`Client connected: ${client.id}`);
    } catch {
      this.logger.warn(`Rejected socket ${client.id}: invalid or expired token`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.authedSockets.delete(client.id);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join:store")
  async onJoinStore(@ConnectedSocket() client: Socket, @MessageBody() payload: { storeId: string }) {
    const auth = this.authedSockets.get(client.id);
    if (!auth) return { ok: false, error: "unauthenticated" };

    // Cross-tenant check: the store must belong to the same company as the caller's token,
    // otherwise any authenticated user could still snoop on another company's till activity.
    const store = await this.prisma.store.findFirst({ where: { id: payload.storeId, companyId: auth.companyId } });
    if (!store) return { ok: false, error: "store not found" };

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
