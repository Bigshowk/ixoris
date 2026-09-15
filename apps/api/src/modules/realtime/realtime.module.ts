import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PosGateway } from "./pos.gateway";

@Module({
  imports: [AuthModule],
  providers: [PosGateway],
  exports: [PosGateway],
})
export class RealtimeModule {}
