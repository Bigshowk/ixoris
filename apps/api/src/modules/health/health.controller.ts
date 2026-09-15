import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";

export interface HealthStatus {
  api: "ok";
  database: "ok" | "error";
  /** The Socket.IO gateway is registered at Nest bootstrap — if this controller can answer, the gateway is up too. */
  websocket: "ok";
  timestamp: string;
}

/** Public, unauthenticated — surfaced on the "À propos" page (live service status) and usable by an external monitor. */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<HealthStatus> {
    let database: HealthStatus["database"] = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
    }

    return {
      api: "ok",
      database,
      websocket: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
