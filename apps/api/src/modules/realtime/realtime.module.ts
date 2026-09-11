import { Module } from "@nestjs/common";
import { PosGateway } from "./pos.gateway";

@Module({
  providers: [PosGateway],
  exports: [PosGateway],
})
export class RealtimeModule {}
