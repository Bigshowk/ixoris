import { Module } from "@nestjs/common";
import { LocalAiController } from "./local-ai.controller";
import { LocalAiService } from "./local-ai.service";

@Module({
  controllers: [LocalAiController],
  providers: [LocalAiService],
})
export class LocalAiModule {}
